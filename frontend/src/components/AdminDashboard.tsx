"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Key,
  LifeBuoy,
  Activity,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Lock,
  LogOut,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import PDFUploader from "./PDFUploader";

interface AdminDashboardProps {
  onBackToChat: () => void;
}

export default function AdminDashboard({ onBackToChat }: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"kb" | "keys" | "tickets" | "logs">("kb");
  const [documents, setDocuments] = useState<any[]>([]);
  const [keysData, setKeysData] = useState<{ keys: any[]; active_pointer_key_id: number | null }>({
    keys: [],
    active_pointer_key_id: null,
  });
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [keyActionMsg, setKeyActionMsg] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketStatusUpdate, setTicketStatusUpdate] = useState("resolved");
  const [ticketNotes, setTicketNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // Check login state
  useEffect(() => {
    const token = localStorage.getItem("vit_admin_token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("http://localhost:8000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        throw new Error("Invalid administrator username or password.");
      }
      const data = await res.json();
      localStorage.setItem("vit_admin_token", data.token);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Authentication failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("vit_admin_token");
    setIsAuthenticated(false);
    setPassword("");
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, keysRes, ticketsRes, logsRes, statsRes] = await Promise.all([
        fetch("http://localhost:8000/api/documents"),
        fetch("http://localhost:8000/api/keys"),
        fetch("http://localhost:8000/api/tickets"),
        fetch("http://localhost:8000/api/audit-logs"),
        fetch("http://localhost:8000/api/stats"),
      ]);

      if (docsRes.ok) {
        const d = await docsRes.json();
        setDocuments(d.documents || []);
      }
      if (keysRes.ok) {
        const k = await keysRes.json();
        setKeysData({ keys: k.keys || [], active_pointer_key_id: k.active_pointer_key_id });
      }
      if (ticketsRes.ok) {
        const t = await ticketsRes.json();
        setTickets(t.tickets || []);
      }
      if (logsRes.ok) {
        const l = await logsRes.json();
        setAuditLogs(l.logs || []);
      }
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
    } catch (err) {
      console.error("Error refreshing dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document and remove its vector embeddings?"))
      return;
    try {
      const res = await fetch(`http://localhost:8000/api/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim() || !newKeyLabel.trim()) return;
    setIsAddingKey(true);
    setKeyActionMsg(null);
    try {
      const res = await fetch("http://localhost:8000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: newKeyValue.trim(), label: newKeyLabel.trim() }),
      });
      if (res.ok) {
        setNewKeyLabel("");
        setNewKeyValue("");
        setKeyActionMsg("Gemini API key added successfully.");
        fetchAllData();
      }
    } catch (err) {
      console.error("Error adding key:", err);
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleToggleKey = async (keyId: number, currentActive: boolean) => {
    try {
      await fetch(`http://localhost:8000/api/keys/${keyId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchAllData();
    } catch (err) {
      console.error("Error toggling key:", err);
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm("Remove this Gemini API key from rotation pool?")) return;
    try {
      await fetch(`http://localhost:8000/api/keys/${keyId}`, { method: "DELETE" });
      fetchAllData();
    } catch (err) {
      console.error("Error deleting key:", err);
    }
  };

  const handleSimulateFailover = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/keys/simulate-failover", {
        method: "POST",
      });
      const data = await res.json();
      setKeyActionMsg(data.message);
      fetchAllData();
    } catch (err) {
      console.error("Error simulating failover:", err);
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      await fetch(`http://localhost:8000/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: ticketStatusUpdate,
          admin_notes: ticketNotes,
        }),
      });
      setSelectedTicket(null);
      fetchAllData();
    } catch (err) {
      console.error("Error updating ticket:", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              VIT Admin Portal
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Knowledge Base ingestion, Round-Robin failover management & Student Handoff
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {loginError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Admin Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                placeholder="Default: vitadmin2026"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-neutral-900 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
            >
              Authenticate & Access Dashboard
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <button
              onClick={onBackToChat}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
            >
              ← Back to Student Helpdesk
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-950">
      {/* Top Navbar */}
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6 dark:border-neutral-800 dark:bg-neutral-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              VIT-Assist Admin Dashboard
            </h1>
            <p className="text-[11px] text-neutral-500">
              Campus RAG Engine • Round-Robin Failover • Support Handoff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            title="Refresh All Metrics"
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onBackToChat}
            className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
          >
            Student Chat
          </button>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-xl bg-neutral-100 p-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Stats Summary Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-6 pb-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Documents
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {stats.total_documents}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Indexed Chunks
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {stats.total_chunks}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Gemini API Keys
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.active_keys}
              </span>
              <span className="text-xs text-neutral-400">/ {stats.total_keys} active</span>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Total API Calls
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {stats.total_api_calls}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Failovers Handled
            </p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stats.total_failovers}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Open Tickets
            </p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {stats.open_tickets}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 px-6 pt-2 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <button
          onClick={() => setActiveTab("kb")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "kb"
              ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Knowledge Base (PDFs)</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] dark:bg-neutral-800">
            {documents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "keys"
              ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <Key className="h-4 w-4" />
          <span>Gemini Key Failover Manager</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] dark:bg-neutral-800">
            {keysData.keys.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "tickets"
              ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <LifeBuoy className="h-4 w-4" />
          <span>Student Handoff Tickets</span>
          <span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] dark:bg-indigo-950/40 dark:text-indigo-300">
            {tickets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "logs"
              ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Audit Logs & Telemetry</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab 1: Knowledge Base */}
        {activeTab === "kb" && (
          <div className="space-y-6">
            <PDFUploader onUploadSuccess={fetchAllData} />

            <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Indexed Campus Reference Documents
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Real-time indexed PDFs serving student queries with source attribution.
                  </p>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No documents found in knowledge base. Upload a PDF above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-800/50">
                      <tr>
                        <th className="px-5 py-3 font-medium">Document Title</th>
                        <th className="px-5 py-3 font-medium">Category</th>
                        <th className="px-5 py-3 font-medium">Pages</th>
                        <th className="px-5 py-3 font-medium">Vector Chunks</th>
                        <th className="px-5 py-3 font-medium">Size</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                          <td className="px-5 py-3.5 font-medium text-neutral-900 dark:text-neutral-100">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-neutral-400 shrink-0" />
                              <span className="truncate max-w-xs">{doc.original_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-300">
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {doc.category || "General"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400">
                            {doc.page_count}
                          </td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400 font-mono">
                            {doc.chunk_count}
                          </td>
                          <td className="px-5 py-3.5 text-neutral-500">
                            {(doc.file_size / 1024).toFixed(1)} KB
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Indexed
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="rounded-lg p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition"
                              title="Delete PDF and purge vector embeddings"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Gemini API Key Rotation & Failover */}
        {activeTab === "keys" && (
          <div className="space-y-6">
            {/* Failover Simulation & Control Header */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Round-Robin Gemini API Key Failover Engine
                  </h3>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    Automatic 429 Interception
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Active traffic rotates smoothly across healthy keys. On quota exhaustion (429) or auth error, pointer shifts seamlessly with zero user disruption.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSimulateFailover}
                  className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 transition"
                  title="Deliberately triggers a 429 quota exhaustion to verify immediate failover shift"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Test 429 Failover Shift</span>
                </button>
              </div>
            </div>

            {keyActionMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 p-3.5 text-xs text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{keyActionMsg}</span>
              </div>
            )}

            {/* Keys Table with Active Pointer Highlighting */}
            <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Configured API Keys Pool
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-800/50">
                    <tr>
                      <th className="px-5 py-3 font-medium">Pointer</th>
                      <th className="px-5 py-3 font-medium">Key Label</th>
                      <th className="px-5 py-3 font-medium">Masked Token</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Calls</th>
                      <th className="px-5 py-3 font-medium">Failovers</th>
                      <th className="px-5 py-3 font-medium">Last Used</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {keysData.keys.map((k) => {
                      const isPointer = k.id === keysData.active_pointer_key_id;
                      return (
                        <tr
                          key={k.id}
                          className={`transition ${
                            isPointer
                              ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                              : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30"
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            {isPointer ? (
                              <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                                <ArrowRight className="h-3.5 w-3.5 animate-pulse" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">
                                  ACTIVE
                                </span>
                              </span>
                            ) : (
                              <span className="text-neutral-300 dark:text-neutral-700">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-neutral-900 dark:text-neutral-100">
                            {k.label}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-neutral-500">
                            {k.masked_key}
                          </td>
                          <td className="px-5 py-3.5">
                            {k.is_rate_limited ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Rate Limited / Cooldown
                              </span>
                            ) : k.is_active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-neutral-700 dark:text-neutral-300 font-mono">
                            {k.total_calls}
                          </td>
                          <td className="px-5 py-3.5 text-amber-600 dark:text-amber-400 font-mono">
                            {k.failed_calls}
                          </td>
                          <td className="px-5 py-3.5 text-neutral-400">
                            {k.last_used_at ? new Date(k.last_used_at).toLocaleTimeString() : "Never"}
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => handleToggleKey(k.id, k.is_active)}
                              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                            >
                              {k.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => handleDeleteKey(k.id)}
                              className="text-xs font-medium text-rose-500 hover:text-rose-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add New Key Form */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Register New Gemini API Key
              </h4>
              <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Key Label / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gemini 1.5 Flash Key 4"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Gemini API Key Token
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="AIzaSy..."
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300 font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isAddingKey}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAddingKey ? "Adding..." : "Add to Key Pool"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Student Handoff Tickets */}
        {activeTab === "tickets" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Student Support Office Escalations
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Automatically submitted when student queries do not match campus documents or when all API keys are saturated.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              {tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500">
                  No support tickets logged.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-800/50">
                      <tr>
                        <th className="px-5 py-3 font-medium">Ticket #</th>
                        <th className="px-5 py-3 font-medium">Student Name</th>
                        <th className="px-5 py-3 font-medium">Reg No</th>
                        <th className="px-5 py-3 font-medium">Category</th>
                        <th className="px-5 py-3 font-medium">Query Summary</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Submitted</th>
                        <th className="px-5 py-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                          <td className="px-5 py-3.5 font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {t.ticket_number}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-neutral-800 dark:text-neutral-200">
                            {t.student_name}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-neutral-500">
                            {t.reg_number}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {t.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                            {t.query_text}
                          </td>
                          <td className="px-5 py-3.5">
                            {t.status === "open" ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                Open
                              </span>
                            ) : t.status === "in_progress" ? (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                In Progress
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Resolved
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-neutral-400">
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedTicket(t);
                                setTicketStatusUpdate(t.status);
                                setTicketNotes(t.admin_notes || "");
                              }}
                              className="text-xs font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ticket Management Modal */}
            {selectedTicket && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                    Manage Ticket #{selectedTicket.ticket_number}
                  </h4>
                  <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-300 mb-4">
                    <p>
                      <strong>Student:</strong> {selectedTicket.student_name} ({selectedTicket.reg_number})
                    </p>
                    <p>
                      <strong>Email:</strong> {selectedTicket.email}
                    </p>
                    <p>
                      <strong>Inquiry:</strong> {selectedTicket.query_text}
                    </p>
                  </div>

                  <form onSubmit={handleUpdateTicket} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Status
                      </label>
                      <select
                        value={ticketStatusUpdate}
                        onChange={(e) => setTicketStatusUpdate(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Resolution Notes
                      </label>
                      <textarea
                        rows={3}
                        value={ticketNotes}
                        onChange={(e) => setTicketNotes(e.target.value)}
                        placeholder="Resolution comments or student response instructions..."
                        className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(null)}
                        className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-xl bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
                      >
                        Save Resolution
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                System Audit Trail & Live Events
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Every API rotation, 429 failover, document ingestion, and student handoff is recorded for auditability.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {auditLogs.map((log) => {
                  let badgeColor = "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
                  if (log.event_type.includes("FAILOVER"))
                    badgeColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
                  else if (log.event_type.includes("ROTATION"))
                    badgeColor = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300";
                  else if (log.event_type.includes("INGEST"))
                    badgeColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
                  else if (log.event_type.includes("TICKET"))
                    badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

                  return (
                    <div key={log.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                            {log.event_type}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
