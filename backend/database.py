import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "campus_helpdesk.db")

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # API Keys table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT,
        api_key TEXT NOT NULL,
        label TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_rate_limited INTEGER DEFAULT 0,
        rate_limit_reset_at TEXT,
        total_calls INTEGER DEFAULT 0,
        failed_calls INTEGER DEFAULT 0,
        last_used_at TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Documents knowledge base table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        category TEXT DEFAULT 'General',
        status TEXT DEFAULT 'indexed',
        uploaded_at TEXT NOT NULL
    )
    """)

    # Support Tickets table (Student Handoff)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        student_name TEXT NOT NULL,
        reg_number TEXT NOT NULL,
        email TEXT NOT NULL,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        query_text TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'open',
        admin_notes TEXT DEFAULT '',
        created_at TEXT NOT NULL
    )
    """)

    # Audit Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Admin Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # Default settings
    default_settings = {
        "similarity_threshold": "0.50",
        "active_key_index": "0",
        "model_name": "gemini-1.5-flash",
        "admin_username": "admin",
        "admin_password": "vitadmin2026"
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)", (k, v))

    conn.commit()
    conn.close()

# ---------------- API Key Operations ----------------

def list_api_keys() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM api_keys ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        key_val = d["api_key"]
        # Mask key for privacy: AIzaSy...Ab12
        if len(key_val) > 10:
            d["masked_key"] = f"{key_val[:6]}...{key_val[-4:]}"
        else:
            d["masked_key"] = "***"
        result.append(d)
    return result

def add_api_key(api_key: str, label: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO api_keys (api_key, label, is_active, is_rate_limited, created_at)
        VALUES (?, ?, 1, 0, ?)
    """, (api_key.strip(), label.strip(), now))
    key_id = cursor.lastrowid
    conn.commit()
    conn.close()
    log_audit("KEY_ADDED", f"New Gemini API key added: '{label}'", {"key_id": key_id, "label": label})
    return key_id

def update_api_key_status(key_id: int, is_active: bool):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE api_keys SET is_active = ? WHERE id = ?", (1 if is_active else 0, key_id))
    conn.commit()
    conn.close()
    log_audit("KEY_STATUS_CHANGED", f"API key {key_id} status set to {'Active' if is_active else 'Disabled'}")

def mark_key_rate_limited(key_id: int, reset_iso: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE api_keys 
        SET is_rate_limited = 1, 
            failed_calls = failed_calls + 1,
            rate_limit_reset_at = ?
        WHERE id = ?
    """, (reset_iso, key_id))
    conn.commit()
    conn.close()

def reset_key_rate_limit(key_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE api_keys 
        SET is_rate_limited = 0, 
            rate_limit_reset_at = NULL
        WHERE id = ?
    """, (key_id,))
    conn.commit()
    conn.close()

def reset_all_keys_rate_limits():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE api_keys SET is_rate_limited = 0, rate_limit_reset_at = NULL")
    conn.commit()
    conn.close()
    log_audit("KEYS_RESTORED", "All Gemini API keys manually restored to active status.")

def record_key_success(key_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
        UPDATE api_keys 
        SET total_calls = total_calls + 1,
            last_used_at = ?,
            is_rate_limited = 0
        WHERE id = ?
    """, (now, key_id))
    conn.commit()
    conn.close()

def delete_api_key(key_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM api_keys WHERE id = ?", (key_id,))
    conn.commit()
    conn.close()
    log_audit("KEY_DELETED", f"API key {key_id} deleted")

# ---------------- Document Operations ----------------

def list_documents() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents ORDER BY uploaded_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_document(doc_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (id, filename, original_name, file_path, file_size, page_count, chunk_count, category, status, uploaded_at)
        VALUES (:id, :filename, :original_name, :file_path, :file_size, :page_count, :chunk_count, :category, :status, :uploaded_at)
    """, doc_data)
    conn.commit()
    conn.close()
    log_audit("DOC_INGESTED", f"Document ingested: '{doc_data['original_name']}' ({doc_data['chunk_count']} chunks)", doc_data)

def delete_document_record(doc_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    if row:
        doc = dict(row)
        cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()
        log_audit("DOC_DELETED", f"Document deleted: '{doc['original_name']}'", {"doc_id": doc_id})
        return doc
    conn.close()
    return None

# ---------------- Ticket Operations (Student Handoff) ----------------

def create_ticket(ticket: Dict[str, Any]) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    import random
    rand_seq = random.randint(1000, 9999)
    ticket_num = f"VIT-{now.strftime('%Y%m')}-{rand_seq}"
    cursor.execute("""
        INSERT INTO tickets (ticket_number, student_name, reg_number, email, category, subject, query_text, priority, status, admin_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', '', ?)
    """, (
        ticket_num,
        ticket["student_name"],
        ticket["reg_number"],
        ticket["email"],
        ticket.get("category", "General"),
        ticket.get("subject", "Campus Query Handoff"),
        ticket["query_text"],
        ticket.get("priority", "Medium"),
        now.isoformat()
    ))
    conn.commit()
    conn.close()
    log_audit("TICKET_CREATED", f"Support ticket generated: {ticket_num} by {ticket['student_name']}", {"ticket_number": ticket_num})
    return ticket_num

def list_tickets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tickets ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_ticket(ticket_id: int, status: str, admin_notes: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE tickets SET status = ?, admin_notes = ? WHERE id = ?", (status, admin_notes, ticket_id))
    conn.commit()
    conn.close()
    log_audit("TICKET_UPDATED", f"Ticket #{ticket_id} updated to status '{status}'")

# ---------------- Audit Logs & Settings ----------------

def log_audit(event_type: str, message: str, details: Optional[Dict[str, Any]] = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        det_str = json.dumps(details) if details else None
        cursor.execute("""
            INSERT INTO audit_logs (event_type, message, details, created_at)
            VALUES (?, ?, ?, ?)
        """, (event_type, message, det_str, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging audit: {e}")

def get_recent_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM admin_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def set_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()
