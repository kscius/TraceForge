"use client";

import { useState } from "react";
import { ProjectBoard } from "@/components/project-board";
import { SettingsPanel } from "@/components/settings-panel";

type View = "board" | "settings";

export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView] = useState<View>("board");
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0 }}>TraceForge</h2>
        <nav className="nav">
          <button
            type="button"
            className={`nav-item ${view === "board" ? "active" : ""}`}
            onClick={() => setView("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
        </nav>
        {workspaceSlug && (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.5rem" }}>
            Workspace: <strong>{workspaceSlug}</strong>
          </p>
        )}
      </aside>
      <main className="main">
        {view === "board" ? (
          <ProjectBoard workspaceSlug={workspaceSlug} onWorkspaceSlug={setWorkspaceSlug} />
        ) : (
          <SettingsPanel
            workspaceSlug={workspaceSlug}
            onWorkspaceChange={setWorkspaceSlug}
            onSignOut={onSignOut}
          />
        )}
      </main>
    </div>
  );
}
