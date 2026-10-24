import os
import re
import json
import uuid
import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pypdf import PdfReader
import google.generativeai as genai

from database import (
    insert_document,
    delete_document_record,
    list_documents,
    get_setting,
    log_audit
)
from key_manager import key_manager, AllKeysExhaustedException, NoActiveKeysException

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage")
PDFS_DIR = os.path.join(STORAGE_DIR, "pdfs")
VECTOR_DB_DIR = os.path.join(STORAGE_DIR, "vector_db")
VECTOR_INDEX_FILE = os.path.join(VECTOR_DB_DIR, "index_metadata.json")
VECTOR_VECTORS_FILE = os.path.join(VECTOR_DB_DIR, "vectors.npy")

os.makedirs(PDFS_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)

class RecursiveTextSplitter:
    def __init__(self, chunk_size: int = 700, chunk_overlap: int = 120):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            if end >= len(text):
                chunks.append(text[start:].strip())
                break

            # Try to break on sentence boundary
            cut_offset = -1
            for sep in [". ", "? ", "! ", "; ", ", ", " "]:
                pos = text.rfind(sep, start, end)
                if pos != -1 and pos > start + self.chunk_overlap:
                    cut_offset = pos + len(sep)
                    break

            if cut_offset == -1:
                cut_offset = end

            chunk = text[start:cut_offset].strip()
            if chunk:
                chunks.append(chunk)

            start = max(start + 1, cut_offset - self.chunk_overlap)

        return chunks

class RAGEngine:
    def __init__(self):
        self.splitter = RecursiveTextSplitter(chunk_size=700, chunk_overlap=120)
        self.chunks_metadata: List[Dict[str, Any]] = []
        self.embeddings_matrix: Optional[np.ndarray] = None
        self.load_index()

    def load_index(self):
        """Loads vector store metadata and embeddings matrix into memory."""
        if os.path.exists(VECTOR_INDEX_FILE) and os.path.exists(VECTOR_VECTORS_FILE):
            try:
                with open(VECTOR_INDEX_FILE, "r", encoding="utf-8") as f:
                    self.chunks_metadata = json.load(f)
                self.embeddings_matrix = np.load(VECTOR_VECTORS_FILE)
            except Exception as e:
                print(f"Error loading vector index: {e}")
                self.chunks_metadata = []
                self.embeddings_matrix = None
        else:
            self.chunks_metadata = []
            self.embeddings_matrix = None

    def save_index(self):
        """Persists vector store metadata and embeddings matrix to disk."""
        with open(VECTOR_INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(self.chunks_metadata, f, indent=2, ensure_ascii=False)
        if self.embeddings_matrix is not None:
            np.save(VECTOR_VECTORS_FILE, self.embeddings_matrix)
        elif os.path.exists(VECTOR_VECTORS_FILE):
            os.remove(VECTOR_VECTORS_FILE)

    def generate_embedding(self, text: str) -> np.ndarray:
        """
        Generates embedding using Gemini text-embedding-004 via the failover KeyManager.
        Falls back to local normalized hash embedding if all keys are unavailable.
        """
        try:
            def _embed(key: str):
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    task_type="retrieval_document"
                )
                return result["embedding"]

            call_res = key_manager.execute_with_failover(_embed)
            vec = np.array(call_res["result"], dtype=np.float32)
            norm = np.linalg.norm(vec)
            return vec / (norm + 1e-10)

        except (AllKeysExhaustedException, NoActiveKeysException, Exception) as exc:
            # Deterministic semantic hash projection as a backup for offline testing
            # Ensures cosine similarity works reliably even if zero Gemini keys are present
            return self._compute_fallback_embedding(text)

    def _compute_fallback_embedding(self, text: str, dim: int = 768) -> np.ndarray:
        import hashlib
        vec = np.zeros(dim, dtype=np.float32)
        words = re.findall(r'\b[a-zA-Z0-9_-]{2,}\b', text.lower())
        if not words:
            vec[0] = 1.0
            return vec
        for word in words:
            # Deterministic hash across Python processes
            h_int = int(hashlib.md5(word.encode('utf-8')).hexdigest()[:8], 16)
            idx = h_int % dim
            val = 1.0 if (h_int % 2 == 0) else -1.0
            vec[idx] += val
        norm = np.linalg.norm(vec)
        return vec / (norm + 1e-10) if norm > 0 else vec

    def index_pdf(self, file_path: str, original_name: str, category: str = "General") -> Dict[str, Any]:
        """
        Parses PDF, chunks text preserving page numbers, generates embeddings,
        and dynamically updates the in-memory vector index and database.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found at {file_path}")

        reader = PdfReader(file_path)
        page_count = len(reader.pages)
        doc_id = str(uuid.uuid4())[:8]

        new_chunks = []
        new_embeddings = []

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            page_text = page.extract_text() or ""
            if not page_text.strip():
                continue

            page_chunks = self.splitter.split_text(page_text)
            for chunk_idx, chunk_content in enumerate(page_chunks):
                chunk_meta = {
                    "chunk_id": f"{doc_id}_p{page_num}_c{chunk_idx}",
                    "doc_id": doc_id,
                    "doc_title": original_name,
                    "category": category,
                    "page_number": page_num,
                    "text": chunk_content
                }
                embedding = self.generate_embedding(chunk_content)
                new_chunks.append(chunk_meta)
                new_embeddings.append(embedding)

        # Update in-memory index
        if new_chunks:
            new_embeddings_arr = np.array(new_embeddings, dtype=np.float32)
            if self.embeddings_matrix is not None and len(self.chunks_metadata) > 0:
                self.embeddings_matrix = np.vstack([self.embeddings_matrix, new_embeddings_arr])
                self.chunks_metadata.extend(new_chunks)
            else:
                self.embeddings_matrix = new_embeddings_arr
                self.chunks_metadata = new_chunks
            
            self.save_index()

        file_size = os.path.getsize(file_path)
        doc_record = {
            "id": doc_id,
            "filename": os.path.basename(file_path),
            "original_name": original_name,
            "file_path": file_path,
            "file_size": file_size,
            "page_count": page_count,
            "chunk_count": len(new_chunks),
            "category": category,
            "status": "indexed",
            "uploaded_at": json.dumps(None) # replaced in insert_document
        }
        
        from datetime import datetime
        doc_record["uploaded_at"] = datetime.now().isoformat()
        insert_document(doc_record)

        return {
            "doc_id": doc_id,
            "title": original_name,
            "pages": page_count,
            "chunks": len(new_chunks)
        }

    def delete_pdf(self, doc_id: str) -> bool:
        """
        Removes PDF from disk, purges its chunks from the vector index,
        and deletes record from SQLite.
        """
        doc = delete_document_record(doc_id)
        if not doc:
            return False

        # Remove physical file
        if os.path.exists(doc["file_path"]):
            try:
                os.remove(doc["file_path"])
            except Exception as e:
                print(f"Error removing file {doc['file_path']}: {e}")

        # Purge chunks from vector index
        if self.chunks_metadata and self.embeddings_matrix is not None:
            indices_to_keep = [i for i, c in enumerate(self.chunks_metadata) if c["doc_id"] != doc_id]
            if len(indices_to_keep) < len(self.chunks_metadata):
                self.chunks_metadata = [self.chunks_metadata[i] for i in indices_to_keep]
                if self.chunks_metadata:
                    self.embeddings_matrix = self.embeddings_matrix[indices_to_keep]
                else:
                    self.embeddings_matrix = None
                self.save_index()

        return True

    def search_chunks(self, query: str, top_k: int = 4) -> List[Tuple[Dict[str, Any], float]]:
        """
        Retrieves Top-K chunks sorted by hybrid similarity (dense cosine + keyword overlap).
        """
        if not self.chunks_metadata or self.embeddings_matrix is None or len(self.chunks_metadata) == 0:
            return []

        query_vec = self.generate_embedding(query)
        # Cosine similarity (vectors are L2-normalized)
        cosine_sims = np.dot(self.embeddings_matrix, query_vec)

        # Token set for keyword overlap
        q_words = set(re.findall(r'\b[a-zA-Z0-9_-]{3,}\b', query.lower()))
        
        scored_results = []
        for idx, (chunk, cos_score) in enumerate(zip(self.chunks_metadata, cosine_sims)):
            # Keyword matching score
            c_words = set(re.findall(r'\b[a-zA-Z0-9_-]{3,}\b', chunk["text"].lower()))
            overlap = len(q_words.intersection(c_words))
            kw_score = min(1.0, overlap / max(1, len(q_words))) if q_words else 0.0

            # Hybrid blended score
            final_score = (0.55 * float(cos_score)) + (0.45 * kw_score)
            scored_results.append((chunk, float(final_score)))

        scored_results.sort(key=lambda x: x[1], reverse=True)
        return scored_results[:top_k]

    def query(self, question: str, session_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Main RAG pipeline:
        1. Retrieves relevant chunks with cosine similarity.
        2. Evaluates threshold. If below threshold, initiates smart fallback handoff.
        3. If confident, queries Gemini LLM with source attribution prompt.
        """
        try:
            threshold = float(get_setting("similarity_threshold", "0.50"))
        except Exception:
            threshold = 0.50

        top_results = self.search_chunks(question, top_k=4)

        # If no knowledge base indexed or best similarity is below threshold
        best_score = top_results[0][1] if top_results else 0.0

        if not top_results or best_score < threshold:
            log_audit(
                "SMART_FALLBACK", 
                f"Query '{question[:60]}' yielded low similarity score ({best_score:.3f} < {threshold:.2f}). Handoff triggered.",
                {"question": question, "best_score": best_score, "threshold": threshold}
            )
            return {
                "reply": "I couldn't find this information in the official campus database. Would you like to submit a ticket to the Student Support Office?",
                "sources": [],
                "fallback_required": True,
                "similarity_score": round(best_score, 3),
                "threshold": threshold,
                "key_used": "N/A"
            }

        # Filter chunks that meet threshold
        relevant_matches = [res for res in top_results if res[1] >= (threshold - 0.05)]
        if not relevant_matches:
            relevant_matches = top_results[:2]

        sources = []
        context_blocks = []
        for chunk, score in relevant_matches:
            source_item = {
                "document_title": chunk["doc_title"],
                "page_number": chunk["page_number"],
                "category": chunk.get("category", "Campus Guidelines"),
                "excerpt": chunk["text"][:240] + ("..." if len(chunk["text"]) > 240 else ""),
                "score": round(score, 3)
            }
            sources.append(source_item)
            context_blocks.append(
                f"[Source: {chunk['doc_title']} | Page: {chunk['page_number']}]\n{chunk['text']}"
            )

        context_text = "\n\n---\n\n".join(context_blocks)

        system_instruction = (
            "You are VIT-Assist, the official AI Campus Helpdesk Assistant for Vellore Institute of Technology (VIT). "
            "Your tone is polite, professional, precise, and supportive. "
            "Answer the student's question based strictly on the provided campus documents below. "
            "Always cite the relevant document title and page number when stating specific regulations, deadlines, contacts, or policies. "
            "If the provided context does not fully answer the question, state what is known and invite the student to submit a ticket to the Student Support Office."
        )

        user_prompt = f"""
Campus Reference Documents:
===========================
{context_text}
===========================

Student Question:
{question}

Provide a clear, helpful, formatted answer using bullet points where appropriate, citing sources clearly.
"""

        try:
            def _generate(key: str):
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=system_instruction
                )
                response = model.generate_content(user_prompt)
                return response.text

            call_res = key_manager.execute_with_failover(_generate)
            ai_reply = call_res["result"]
            key_label = call_res["key_label"]

            log_audit(
                "QUERY_SUCCESS", 
                f"Query answered via {key_label}. Best similarity: {best_score:.3f}",
                {"question": question[:80], "key_used": key_label, "score": best_score}
            )

            return {
                "reply": ai_reply,
                "sources": sources,
                "fallback_required": False,
                "similarity_score": round(best_score, 3),
                "threshold": threshold,
                "key_used": key_label
            }

        except (AllKeysExhaustedException, NoActiveKeysException) as e:
            # Fallback when all keys are exhausted
            log_audit("KEYS_EXHAUSTED_FALLBACK", f"All Gemini keys exhausted for query: {question[:60]}")
            fallback_text = (
                "All campus AI response capacity is currently experiencing heavy load (all API keys rate-limited). "
                "However, here are the most relevant sections found in the campus documents:\n\n"
            )
            for s in sources:
                fallback_text += f"• **{s['document_title']}** (Page {s['page_number']}): \"{s['excerpt']}\"\n\n"
            fallback_text += "\nWould you like to submit a ticket to the Student Support Office?"

            return {
                "reply": fallback_text,
                "sources": sources,
                "fallback_required": True,
                "similarity_score": round(best_score, 3),
                "threshold": threshold,
                "key_used": "All Keys Exhausted (Capacity Saturated)"
            }

rag_engine = RAGEngine()
