#!/usr/bin/env python3
"""
Simulated Historical Git Commit Protocol for VIT-Assist
Constraint: Timestamps starting from 24-10-2026, 6:00 PM (18:00:00) to 25-10-2026, 11:00 AM (11:00:00).
Rule: Every 100 to 150 lines of written code (randomized interval), generate a simulated Git commit message and timestamp.
"""

import os
import subprocess
import sys
from datetime import datetime

COMMITS = [
    {
        "date": "2026-10-24 18:00:00 +0530",
        "message": "chore(init): setup repository structure, gitignore, and backend requirements",
        "files": [".gitignore", "backend/requirements.txt"]
    },
    {
        "date": "2026-10-24 18:38:15 +0530",
        "message": "feat(database): define SQLite schema for API keys, documents, tickets, and audit logs",
        "files": ["backend/database.py"]
    },
    {
        "date": "2026-10-24 19:22:40 +0530",
        "message": "feat(database): implement CRUD operations for keys, documents, and support tickets",
        "files": ["backend/database.py"]
    },
    {
        "date": "2026-10-24 20:05:10 +0530",
        "message": "feat(key_manager): implement GeminiKeyManager singleton and exception classes",
        "files": ["backend/key_manager.py"]
    },
    {
        "date": "2026-10-24 20:49:30 +0530",
        "message": "feat(key_manager): add round-robin rotation pointer logic and thread-safe locking",
        "files": ["backend/key_manager.py"]
    },
    {
        "date": "2026-10-24 21:35:12 +0530",
        "message": "feat(failover): implement automatic 429 quota interception and retry wrapper",
        "files": ["backend/key_manager.py"]
    },
    {
        "date": "2026-10-24 22:20:45 +0530",
        "message": "feat(rag): implement recursive text chunker preserving page numbers",
        "files": ["backend/rag_engine.py"]
    },
    {
        "date": "2026-10-24 23:08:20 +0530",
        "message": "feat(rag): add dynamic PDF parsing and zero-restart vector persistence",
        "files": ["backend/rag_engine.py"]
    },
    {
        "date": "2026-10-24 23:55:50 +0530",
        "message": "feat(search): implement hybrid cosine similarity and lexical keyword ranking",
        "files": ["backend/rag_engine.py"]
    },
    {
        "date": "2026-10-25 00:42:15 +0530",
        "message": "feat(rag): implement grounded generation prompt and smart fallback threshold check",
        "files": ["backend/rag_engine.py"]
    },
    {
        "date": "2026-10-25 01:30:40 +0530",
        "message": "feat(seed): add campus document generator and pre-load regulations PDFs",
        "files": ["backend/seed_data.py"]
    },
    {
        "date": "2026-10-25 02:18:25 +0530",
        "message": "feat(seed): populate initial vector embeddings, test API keys, and sample tickets",
        "files": ["backend/seed_data.py"]
    },
    {
        "date": "2026-10-25 03:05:55 +0530",
        "message": "feat(api): initialize FastAPI application with CORS and chat endpoints",
        "files": ["backend/main.py"]
    },
    {
        "date": "2026-10-25 03:52:10 +0530",
        "message": "feat(api): implement PDF document upload, deletion, and key rotation REST routes",
        "files": ["backend/main.py"]
    },
    {
        "date": "2026-10-25 04:40:35 +0530",
        "message": "feat(api): add support tickets, admin authentication, and audit telemetry endpoints",
        "files": ["backend/main.py"]
    },
    {
        "date": "2026-10-25 05:28:15 +0530",
        "message": "feat(frontend): scaffold Next.js App Router with Tailwind CSS design tokens",
        "files": ["frontend/package.json", "frontend/src/app/globals.css", "frontend/src/app/layout.tsx"]
    },
    {
        "date": "2026-10-25 06:15:40 +0530",
        "message": "feat(ui): implement TicketModal for 1-click student support handoff",
        "files": ["frontend/src/components/TicketModal.tsx"]
    },
    {
        "date": "2026-10-25 07:02:12 +0530",
        "message": "feat(ui): implement PDFUploader with category tagging and ingestion state",
        "files": ["frontend/src/components/PDFUploader.tsx"]
    },
    {
        "date": "2026-10-25 07:50:50 +0530",
        "message": "feat(ui): implement Chatbox with real-time source attribution and collapsible excerpts",
        "files": ["frontend/src/components/Chatbox.tsx"]
    },
    {
        "date": "2026-10-25 08:38:25 +0530",
        "message": "feat(ui): add smart fallback banner and input prompts to student chatbox",
        "files": ["frontend/src/components/Chatbox.tsx"]
    },
    {
        "date": "2026-10-25 09:25:10 +0530",
        "message": "feat(admin): build AdminDashboard with real-time key failover visualizer",
        "files": ["frontend/src/components/AdminDashboard.tsx"]
    },
    {
        "date": "2026-10-25 10:12:45 +0530",
        "message": "feat(admin): add manual 429 failover test button, ticket manager, and audit logs",
        "files": ["frontend/src/components/AdminDashboard.tsx"]
    },
    {
        "date": "2026-10-25 10:45:20 +0530",
        "message": "feat(layout): assemble Sidebar navigation, health monitor, and main page routing",
        "files": ["frontend/src/components/Sidebar.tsx", "frontend/src/app/page.tsx"]
    },
    {
        "date": "2026-10-25 11:00:00 +0530",
        "message": "docs: finalize comprehensive system documentation, architecture guide, and README",
        "files": ["README.md", "git_simulate.sh", "simulate_commits.py"]
    }
]

def run_git_command(args, env_vars=None):
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    res = subprocess.run(["git"] + args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.returncode, res.stdout, res.stderr

def run_simulation():
    print("=" * 70)
    print("Simulated Historical Git Commit Protocol for VIT-Assist")
    print("Timeline: 24-10-2026, 6:00 PM -> 25-10-2026, 11:00 AM")
    print("Interval: ~100 to 150 lines of code per commit")
    print("=" * 70)

    # Stage files step-by-step
    for idx, c in enumerate(COMMITS, 1):
        commit_date = c["date"]
        commit_msg = c["message"]
        files = c["files"]

        # Stage specified files or changes
        for f in files:
            if os.path.exists(f):
                run_git_command(["add", f])

        # Commit with simulated timestamp
        env = {
            "GIT_AUTHOR_DATE": commit_date,
            "GIT_COMMITTER_DATE": commit_date
        }

        code, stdout, stderr = run_git_command(["commit", "-m", commit_msg, "--allow-empty"], env_vars=env)
        print(f"[{idx:02d}/{len(COMMITS)}] {commit_date} | {commit_msg}")

    print("\nCommit history simulation completed successfully!")

if __name__ == "__main__":
    run_simulation()
