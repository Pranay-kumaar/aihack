"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Chatbox from "@/components/Chatbox";
import AdminDashboard from "@/components/AdminDashboard";

export default function Home() {
  const [currentView, setCurrentView] = useState<"chat" | "admin">("chat");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {currentView === "chat" ? (
          <Chatbox />
        ) : (
          <AdminDashboard onBackToChat={() => setCurrentView("chat")} />
        )}
      </main>
    </div>
  );
}
