"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Shield,
  BookOpen,
  Key,
  LifeBuoy,
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  currentView: "chat" | "admin";
  onSelectView: (view: "chat" | "admin") => void;
}

export default function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [stats, setStats] = useState<{ docs: number; keys: number } | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/health");
        if (res.ok) {
          const data = await res.json();
          setBackendStatus("online");
          setStats({ docs: data.vector_chunks || 0, keys: data.keys_count || 0 });
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 border-r border-neutral-200 bg-white flex flex-col justify-between dark:border-neutral-800 dark:bg-neutral-900 shrink-0">
      <div className="p-5 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              VIT-Assist
            </h2>
            <p className="text-[11px] text-neutral-400 font-medium">Campus AI Helpdesk</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <nav className="space-y-1.5">
          <button
            onClick={() => onSelectView("chat")}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              currentView === "chat"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Student Helpdesk</span>
          </button>

          <button
            onClick={() => onSelectView("admin")}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              currentView === "admin"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            <div className="flex items-center justify-between flex-1">
              <span>Admin Portal</span>
              <span className="text-[10px] rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 font-mono">
                RAG + Keys
              </span>
            </div>
          </button>
        </nav>

        {/* System Overview Information */}
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5 dark:border-neutral-800/80 dark:bg-neutral-800/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              System Engine
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-500 animate-pulse"
                    : backendStatus === "checking"
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-[10px] font-mono text-neutral-500 capitalize">
                {backendStatus}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
            <div className="flex justify-between">
              <span>RAG Store:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {stats ? `${stats.docs} Chunks` : "Connecting..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Failover Keys:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {stats ? `${stats.keys} Configured` : "3 Loaded"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Model:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                gemini-1.5-flash
              </span>
            </div>
          </div>
        </div>

        {/* Campus Knowledge Topics */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 px-1">
            Indexed Knowledge Modules
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
              <span>Academic Regulations & FFCS</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
              <span>Hostel Norms & Biometrics</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
              <span>CAT & FAT Grading Schemes</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
              <span>Health Centre & Emergency 2100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
        <span>VIT-Assist v1.0</span>
        <span className="font-mono">Oct 2026</span>
      </div>
    </aside>
  );
}
