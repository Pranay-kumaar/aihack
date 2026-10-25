"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  KeyRound,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import TicketModal from "./TicketModal";

interface SourceItem {
  document_title: string;
  page_number: number;
  category: string;
  excerpt: string;
  score: number;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: SourceItem[];
  fallback_required?: boolean;
  similarity_score?: number;
  key_used?: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  "What is the minimum attendance required at VIT?",
  "What are the hostel curfew and biometric timings?",
  "Where is the campus health centre located for emergencies?",
  "How is CGPA calculated and what is the Dean's list criteria?",
];

export default function Chatbox() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am **VIT-Assist**, your AI Campus Helpdesk Assistant. Ask me anything about university academic policies, hostel regulations, examination procedures, health services, or campus guidelines.",
      timestamp: "Helpdesk Online",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Ticket Modal state
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketPrefillQuery, setTicketPrefillQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleSourceExpand = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: messages.slice(-4).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("Campus Helpdesk API is currently offline or unreachable.");
      }

      const data = await res.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.reply,
        sources: data.sources || [],
        fallback_required: data.fallback_required,
        similarity_score: data.similarity_score,
        key_used: data.key_used,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "I encountered an error connecting to the campus assistance server. Would you like to submit a ticket to the Student Support Office?",
        fallback_required: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const openTicketForm = (query: string) => {
    setTicketPrefillQuery(query);
    setTicketModalOpen(true);
  };

  const handleTicketCreated = (ticketNumber: string) => {
    const confirmMsg: Message = {
      id: (Date.now() + 2).toString(),
      sender: "assistant",
      text: `Your ticket **#${ticketNumber}** has been recorded and dispatched to the VIT Student Support Office. An administrator will review your query promptly.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-neutral-50/30 dark:bg-neutral-950">
      {/* Ticket Modal */}
      <TicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        initialQuery={ticketPrefillQuery}
        onTicketCreated={handleTicketCreated}
      />

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-medium text-neutral-400">
                  {msg.sender === "user" ? "You" : "VIT-Assist AI"}
                </span>
                <span className="text-[10px] text-neutral-400">• {msg.timestamp}</span>
                {msg.key_used && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                    <KeyRound className="h-3 w-3" />
                    {msg.key_used}
                  </span>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-5 py-3.5 text-xs md:text-sm leading-relaxed max-w-[88%] md:max-w-[80%] ${
                  msg.sender === "user"
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 rounded-br-xs"
                    : "bg-white border border-neutral-200/80 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 rounded-bl-xs shadow-xs"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Source Attribution Cards */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Retrieved Campus Sources ({msg.sources.length})</span>
                      </div>
                      <button
                        onClick={() => toggleSourceExpand(msg.id)}
                        className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
                      >
                        {expandedSources[msg.id] ? (
                          <>
                            <span>Hide Excerpts</span>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View Excerpts</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 rounded-lg border border-neutral-200/60 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-300"
                        >
                          <span className="font-semibold">{src.document_title}</span>
                          <span className="text-neutral-400">|</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Page {src.page_number}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Collapsible detailed excerpts */}
                    {expandedSources[msg.id] && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-dashed border-neutral-100 dark:border-neutral-800 animate-in fade-in duration-150">
                        {msg.sources.map((src, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-2.5 text-[11px] dark:border-neutral-800 dark:bg-neutral-800/30"
                          >
                            <div className="flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                              <span>
                                {src.document_title} (Page {src.page_number})
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                Match: {(src.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-400 italic">
                              "{src.excerpt}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Smart Fallback & Handoff Prompt */}
                {msg.fallback_required && (
                  <div className="mt-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-950/60 dark:bg-amber-950/20">
                      <div className="flex items-start gap-2">
                        <LifeBuoy className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-2 flex-1">
                          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                            Need direct campus officer assistance? You can submit a formal ticket directly to the Student Support Office.
                          </p>
                          <button
                            onClick={() =>
                              openTicketForm(
                                messages.find(
                                  (m, idx) =>
                                    idx < messages.indexOf(msg) && m.sender === "user"
                                )?.text || "Campus Support Inquiry"
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
                          >
                            <LifeBuoy className="h-3.5 w-3.5" />
                            <span>1-Click Ticket Generation</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200/60 dark:bg-neutral-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-600 dark:text-neutral-300" />
              </div>
              <span className="italic">
                Retrieving campus documents & consulting Gemini LLM...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Campus Questions Bar */}
      {messages.length < 3 && (
        <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="max-w-3xl mx-auto">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Frequent Campus Queries
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  className="rounded-xl border border-neutral-200/80 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-300 dark:hover:bg-neutral-800 transition text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask anything about attendance, hostels, exams, FFCS, or health center..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-xs md:text-sm text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-100 dark:focus:border-neutral-200 transition"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
