"use client";

import { useEffect, useState } from "react";
import { api, setToken } from "@/lib/api";
import { ProjectBoard } from "@/components/project-board";

type LoginResponse = {
  accessToken: string;
  user: { email: string; name: string | null };
};

export default function HomePage() {
  const [email, setEmail] = useState("demo@traceforge.local");
  const [password, setPassword] = useState("demo123456");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(Boolean(localStorage.getItem("traceforge_token")));
  }, []);

  async function login() {
    setError(null);
    try {
      const res = await api<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.accessToken);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  if (!authed) {
    return (
      <main className="main" style={{ maxWidth: 420, margin: "4rem auto" }}>
        <h1>TraceForge</h1>
        <p style={{ color: "var(--muted)" }}>Sign in to your self-hosted workspace.</p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button onClick={login}>Sign in</button>
          {error && <p style={{ color: "#f87171" }}>{error}</p>}
        </div>
      </main>
    );
  }

  return <ProjectBoard />;
}
