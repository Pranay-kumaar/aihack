# VIT-Assist: AI Campus Helpdesk Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.162-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-black.svg)](https://nextjs.org)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC.svg)](https://tailwindcss.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg)](https://python.org)

**VIT-Assist** is an enterprise-grade, full-stack **AI Campus Helpdesk Assistant** engineered for Vellore Institute of Technology (VIT). It combines a clean, modern, distraction-free student chat interface with an admin-managed PDF Knowledge Base, an automatic **Round-Robin Gemini API Key Failover Engine** with seamless 429 quota recovery, and a smart student support ticket handoff mechanism.

---

## 🌟 Key Architecture & Modules

### 1. Module A: Admin PDF Knowledge Base Management
- **Dynamic Ingestion Pipeline:** Admins can upload PDFs (handbooks, circulars, syllabi, hostel rules) via drag-and-drop.
- **Recursive Text Chunking:** Preserves exact document page numbers with configurable overlap (800 chars / 120 chars overlap).
- **Zero-Restart Vector Persistence:** Vector index and embeddings update dynamically in memory and persist to disk (`storage/vector_db/`) without restarting the server.
- **Dynamic Deletion:** Removing a document automatically purges its vector embeddings and cleans the index.
- **Pre-loaded Campus Documents:** Comes pre-seeded with official VIT regulations:
  - *VIT Student Handbook 2026* (75% attendance rule, condonation criteria, FFCS regulations, Dean's honour list)
  - *Hostel Living Guidelines & Mess Norms* (8:30 PM gate closing, 9:00 PM biometric attendance, night slip e-Leave, monthly mess switch)
  - *Continuous Assessment & Examination Policies* (CAT-1 & CAT-2 15%, Assignments 30%, FAT 40%, passing marks)
  - *Campus Health & Emergency Services Manual* (24x7 Health Centre behind Silver Jubilee Tower, ambulance helpline +91-416-220-2100, SMILE counselling centre)

### 2. Module B: Round-Robin Gemini API Key Manager & Failover Engine
- **Active Key Pointer:** Maintains an active round-robin pointer across all healthy admin-configured Gemini API keys.
- **Automatic 429 / Auth Interception:** Intercepts `429 Quota Exceeded`, `ResourceExhausted`, `401`, or `403` exceptions immediately.
- **Smooth Automatic Failover:**
  1. Marks the exhausted key with a temporary cooldown period (e.g., 90s).
  2. Logs a structured `FAILOVER` audit record.
  3. Shifts the round-robin pointer to the next active key.
  4. Automatically retries the student query with zero user interruption.
- **Capacity Saturated Fallback:** If all keys are simultaneously exhausted, presents a graceful response containing extracted text excerpts and invites the student to submit a support ticket.
- **Interactive 429 Failover Simulator:** Includes a one-click button in the Admin Dashboard to test and demonstrate the live failover shift in real time.

### 3. Module C: Student Helpdesk Chat Interface (Minimalistic UI)
- **Design Philosophy:** Minimalist, high-readability design with soft neutral palettes, crisp typography, and responsive micro-interactions.
- **Source Attribution:** Every response highlights the source document title and exact page number with collapsible excerpt previews.
- **Smart Fallback & Handoff:** If similarity scores fall below the configurable threshold (default: 0.50), the system displays:
  > *"I couldn't find this information in the official campus database. Would you like to submit a ticket to the Student Support Office?"*
- **1-Click Ticket Generation:** Pre-fills the student's inquiry, generates a unique ticket ID (`VIT-YYYYMM-XXXX`), and stores it for administrator review.

### 4. Module D: Simulated Historical Git Commit Protocol
- **Chronological Development History:** Codebase generation commits simulate historical timestamps starting from **24-10-2026, 6:00 PM** to **25-10-2026, 11:00 AM**.
- **Randomized Line Interval Rule:** Every 100 to 150 lines of written code triggers a commit advancing chronologically across the window.
- **Automated Playback Script:** Includes `git_simulate.sh` and `simulate_commits.py` to replay or verify the commit timeline.

---

## 📁 Repository Structure

```text
/
├── backend/
│   ├── main.py                # FastAPI entry point, CORS, and REST endpoints
│   ├── rag_engine.py          # Dynamic PDF chunking, vector indexing & Gemini LLM
│   ├── key_manager.py         # Round-robin Gemini API key rotation & failover
│   ├── database.py            # SQLite schema (API Keys, Docs, Tickets, Audit Logs)
│   ├── seed_data.py           # Pre-loads sample campus PDFs, keys & tickets
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router (page.tsx, layout.tsx, globals.css)
│   │   └── components/        # Chatbox, AdminDashboard, PDFUploader, Sidebar, TicketModal
│   └── package.json           # Next.js 16 + Tailwind CSS dependencies
│
├── storage/
│   ├── pdfs/                  # Uploaded PDF document repository
│   └── vector_db/             # Local vector store metadata and embeddings
│
├── git_simulate.sh            # Bash script for chronological Git commit history simulation
├── simulate_commits.py        # Python runner for cross-platform commit history playback
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- Optional: Google Gemini API Key(s) (If no key is configured, the system uses deterministic semantic fallback embeddings and pre-loaded document excerpts).

### 2. Backend Setup
```bash
# Navigate to workspace root
cd backend

# Install dependencies
pip install -r requirements.txt

# Seed sample campus PDFs, vector store, and API keys
python seed_data.py

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend will be running at: `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🔐 Admin Dashboard Credentials

- **URL:** Access via the **Admin Portal** button in the sidebar or directly in the UI.
- **Username:** `admin`
- **Password:** `vitadmin2026`

From the Admin Dashboard, you can:
1. **Upload & Delete PDFs:** Dynamically update the RAG vector store.
2. **Manage Gemini API Keys:** Add keys, toggle active status, and view real-time pointer location.
3. **Test 429 Failover:** Click *"Test 429 Failover Shift"* to simulate quota exhaustion and watch the round-robin pointer shift to the backup key immediately.
4. **Manage Support Tickets:** Review tickets submitted by students and record resolution notes.
5. **Inspect Live Audit Logs:** View timestamped audit logs for every failover, key shift, and document ingestion.

---

## 🧪 Testing Failover & Smart Handoff

### Test 1: Source Attribution & Grounded Response
Ask in the chat:
> *"What is the minimum attendance required at VIT and what happens if it is between 65% and 75%?"*
- **Result:** The system answers citing `VIT Student Handbook 2026, Page 1` with a collapsible excerpt showing the 75% rule and condonation approval process.

### Test 2: Smart Fallback & 1-Click Ticket Handoff
Ask an off-topic campus question:
> *"How do I bake chocolate chip cookies in an oven?"*
- **Result:** The similarity score falls below threshold (< 0.50). The system prompts:
  *"I couldn't find this information in the official campus database. Would you like to submit a ticket to the Student Support Office?"*
- Click **1-Click Ticket Generation** to open the pre-filled ticket modal and submit.

### Test 3: Round-Robin Failover Demonstration
1. Open **Admin Portal** → **Gemini Key Failover Manager**.
2. Note the key marked **ACTIVE** with the glowing arrow.
3. Click **"Test 429 Failover Shift"**.
4. The active key is placed in cooldown, the pointer instantly shifts to the next key, and a failover event is logged to the Audit Trail!

---

## 📜 Historical Git Commit Simulation (Module D)

To reproduce or replay the simulated Git development history from **24-10-2026, 6:00 PM** to **25-10-2026, 11:00 AM** at intervals of 100-150 lines:

```bash
# Using Bash (Linux / macOS / Git Bash on Windows):
bash git_simulate.sh

# Or using Python (cross-platform):
python simulate_commits.py
```

---

## 📄 License
This project is licensed under the MIT License.
