"use client";

import React, { useState } from "react";
import { X, Send, CheckCircle2, AlertCircle } from "lucide-react";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onTicketCreated?: (ticketNumber: string) => void;
}

export default function TicketModal({
  isOpen,
  onClose,
  initialQuery = "",
  onTicketCreated,
}: TicketModalProps) {
  const [studentName, setStudentName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("General Support");
  const [priority, setPriority] = useState("Medium");
  const [queryText, setQueryText] = useState(initialQuery);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(null);

  // Sync initial query when opened
  React.useEffect(() => {
    if (initialQuery) {
      setQueryText(initialQuery);
    }
  }, [initialQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("http://localhost:8000/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          reg_number: regNumber,
          email,
          category,
          subject: queryText.slice(0, 60) + (queryText.length > 60 ? "..." : ""),
          query_text: queryText,
          priority,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit support ticket. Please check backend connection.");
      }

      const data = await res.json();
      setCreatedTicketNumber(data.ticket_number);
      if (onTicketCreated) {
        onTicketCreated(data.ticket_number);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedTicketNumber(null);
    setStudentName("");
    setRegNumber("");
    setEmail("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Submit Ticket to Student Support
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Official handoff to the VIT Student Affairs & Support Office
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {createdTicketNumber ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Ticket Generated Successfully
              </h4>
              <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                #{createdTicketNumber}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
                Your inquiry has been assigned to the relevant department coordinator. An email update will be sent to your registered student email address.
              </p>
            </div>
            <div className="pt-3">
              <button
                onClick={handleResetAndClose}
                className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
              >
                Return to Helpdesk
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 23BCE1042"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Student Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name.2023@vitstudent.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
                >
                  <option value="Academics & Attendance">Academics & Attendance</option>
                  <option value="Hostel & Mess">Hostel & Mess</option>
                  <option value="Examinations & FAT">Examinations & FAT</option>
                  <option value="Health & Emergency">Health & Emergency</option>
                  <option value="General Support">General Support</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Inquiry Description *
              </label>
              <textarea
                required
                rows={3}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Describe what assistance or clarification you need..."
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-100 dark:focus:border-neutral-300"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
