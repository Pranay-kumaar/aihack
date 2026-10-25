import os
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from database import (
    init_db,
    list_api_keys,
    add_api_key,
    update_api_key_status,
    delete_api_key,
    list_documents,
    create_ticket,
    list_tickets,
    update_ticket,
    get_recent_audit_logs,
    get_setting,
    set_setting,
    log_audit
)
from key_manager import key_manager
from rag_engine import rag_engine, PDFS_DIR

# Initialize database schema on startup
init_db()

app = FastAPI(
    title="VIT-Assist Campus Helpdesk API",
    description="Full-stack AI Campus Helpdesk Assistant with Round-Robin Gemini Failover & PDF Knowledge Base",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Request / Response Models -----------------

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    history: Optional[List[Dict[str, str]]] = []

class KeyCreateRequest(BaseModel):
    api_key: str
    label: str

class KeyToggleRequest(BaseModel):
    is_active: bool

class TicketCreateRequest(BaseModel):
    student_name: str
    reg_number: str
    email: str
    category: Optional[str] = "General Support"
    subject: Optional[str] = "Campus Helpdesk Query"
    query_text: str
    priority: Optional[str] = "Medium"

class TicketUpdateRequest(BaseModel):
    status: str
    admin_notes: Optional[str] = ""

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class SettingUpdateRequest(BaseModel):
    similarity_threshold: Optional[str] = None

# ----------------- Endpoints -----------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VIT-Assist Backend",
        "vector_chunks": len(rag_engine.chunks_metadata),
        "keys_count": len(key_manager.get_all_keys())
    }

@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest):
    stored_user = get_setting("admin_username", "admin")
    stored_pass = get_setting("admin_password", "vitadmin2026")
    if req.username == stored_user and req.password == stored_pass:
        log_audit("ADMIN_LOGIN", f"Admin user '{req.username}' logged into dashboard.")
        return {"success": True, "token": "vit-admin-session-token", "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid administrator credentials.")

# ----------------- Chat & RAG -----------------

@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    result = rag_engine.query(req.message.strip(), req.history)
    return result

# ----------------- Documents / Knowledge Base -----------------

@app.get("/api/documents")
def get_documents():
    docs = list_documents()
    return {"documents": docs, "total": len(docs)}

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("General")
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_path = os.path.join(PDFS_DIR, file.filename)
    # Save uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Dynamically ingest PDF and update vector store
        ingest_res = rag_engine.index_pdf(file_path, file.filename, category=category)
        return {
            "success": True,
            "message": f"Successfully ingested and indexed '{file.filename}'",
            "data": ingest_res
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process and index PDF: {str(e)}")

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    success = rag_engine.delete_pdf(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"success": True, "message": "Document and associated vector chunks purged successfully."}

# ----------------- API Key Rotation & Failover -----------------

@app.get("/api/keys")
def get_keys():
    eligible = key_manager.get_eligible_keys()
    all_keys = list_api_keys()
    active_idx = (key_manager.pointer % len(eligible)) if eligible else 0
    active_key_id = eligible[active_idx]["id"] if eligible else None

    # Augment with pointer indicator
    for k in all_keys:
        k["is_current_pointer"] = (k["id"] == active_key_id)

    return {
        "keys": all_keys,
        "total": len(all_keys),
        "active_pointer_key_id": active_key_id,
        "pointer_index": key_manager.pointer
    }

@app.post("/api/keys")
def create_key(req: KeyCreateRequest):
    if not req.api_key.strip():
        raise HTTPException(status_code=400, detail="API Key cannot be empty.")
    key_id = add_api_key(req.api_key, req.label)
    return {"success": True, "key_id": key_id, "message": f"Gemini API key '{req.label}' added successfully."}

@app.patch("/api/keys/{key_id}/toggle")
def toggle_key(key_id: int, req: KeyToggleRequest):
    update_api_key_status(key_id, req.is_active)
    return {"success": True, "message": f"Key {key_id} status updated."}

@app.delete("/api/keys/{key_id}")
def remove_key(key_id: int):
    delete_api_key(key_id)
    return {"success": True, "message": f"Key {key_id} deleted."}

@app.post("/api/keys/simulate-failover")
def simulate_failover():
    res = key_manager.simulate_manual_failover()
    return res

@app.post("/api/keys/reset-all")
def reset_all_keys_endpoint():
    from database import reset_all_keys_rate_limits
    reset_all_keys_rate_limits()
    return {"success": True, "message": "All keys restored to active state."}

# ----------------- Support Tickets (Student Handoff) -----------------

@app.get("/api/tickets")
def get_tickets():
    tickets = list_tickets()
    return {"tickets": tickets, "total": len(tickets)}

@app.post("/api/tickets")
def submit_ticket(req: TicketCreateRequest):
    ticket_num = create_ticket(req.dict())
    return {
        "success": True,
        "ticket_number": ticket_num,
        "message": "Your ticket has been officially forwarded to the VIT Student Support Office."
    }

@app.patch("/api/tickets/{ticket_id}")
def update_ticket_status(ticket_id: int, req: TicketUpdateRequest):
    update_ticket(ticket_id, req.status, req.admin_notes or "")
    return {"success": True, "message": f"Ticket #{ticket_id} updated."}

# ----------------- Audit Logs & Dashboard Stats -----------------

@app.get("/api/audit-logs")
def get_audit_logs(limit: int = 50):
    logs = get_recent_audit_logs(limit)
    return {"logs": logs, "total": len(logs)}

@app.get("/api/stats")
def get_dashboard_stats():
    keys = list_api_keys()
    eligible_keys = [k for k in keys if k["is_active"] and not k["is_rate_limited"]]
    docs = list_documents()
    tickets = list_tickets()
    open_tickets = [t for t in tickets if t["status"] == "open"]

    total_calls = sum(k.get("total_calls", 0) for k in keys)
    total_failures = sum(k.get("failed_calls", 0) for k in keys)
    
    threshold = get_setting("similarity_threshold", "0.50")

    return {
        "total_documents": len(docs),
        "total_chunks": len(rag_engine.chunks_metadata),
        "total_keys": len(keys),
        "active_keys": len(eligible_keys),
        "total_api_calls": total_calls,
        "total_failovers": total_failures,
        "open_tickets": len(open_tickets),
        "total_tickets": len(tickets),
        "similarity_threshold": float(threshold)
    }

@app.post("/api/settings")
def update_settings(req: SettingUpdateRequest):
    if req.similarity_threshold is not None:
        set_setting("similarity_threshold", str(req.similarity_threshold))
        log_audit("SETTINGS_UPDATED", f"RAG similarity threshold updated to {req.similarity_threshold}")
    return {"success": True, "message": "Settings updated."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
