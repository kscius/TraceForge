"use client";

import { useState } from "react";
import { api, setToken } from "@/lib/api";

type AuthMode = "login" | "register";

type LoginResponse = {
  accessToken: string;
  user: { email: string; name: string | null };
};

const showDemoHint = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === "true";

export function AuthForm({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const res = await api<LoginResponse>("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(res.accessToken);
      } else {
        const res = await api<LoginResponse>("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, name: name.trim() || undefined }),
        });
        setToken(res.accessToken);
      }
      onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="main" style={{ maxWidth: 420, margin: "4rem auto" }}>
      <h1>TraceForge</h1>
      <p style={{ color: "var(--muted)" }}>Sign in to your self-hosted workspace.</p>

      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`tab ${mode === "login" ? "active" : ""}`}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`tab ${mode === "register" ? "active" : ""}`}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {mode === "register" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min. 8 characters)"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button type="button" onClick={submit} disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
      </div>

      {showDemoHint && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.5rem" }}>
          Local demo (dev only): <code>demo@traceforge.local</code> / <code>demo123456</code>
        </p>
      )}
    </main>
  );
}
