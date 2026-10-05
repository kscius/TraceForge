"use client";

import { useCallback, useEffect, useState } from "react";
import { api, clearToken, getApiPublicUrl } from "@/lib/api";

type Workspace = { id: string; slug: string; name: string; role: string };
type ApiTokenMeta = {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
};
type GithubRepo = { id: string; fullName: string; defaultBranch: string };

type SettingsPanelProps = {
  workspaceSlug: string | null;
  onWorkspaceChange: (slug: string) => void;
  onSignOut: () => void;
};

export function SettingsPanel({ workspaceSlug, onWorkspaceChange, onSignOut }: SettingsPanelProps) {
  const [user, setUser] = useState<{ email: string; name: string | null } | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tokens, setTokens] = useState<ApiTokenMeta[]>([]);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [newTokenName, setNewTokenName] = useState("Cursor MCP");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [wsSlug, setWsSlug] = useState("");
  const [wsName, setWsName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [repoFullName, setRepoFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slug = workspaceSlug ?? workspaces[0]?.slug ?? null;
  const apiUrl = getApiPublicUrl();
  const webhookUrl = `${apiUrl}/api/v1/webhooks/github`;

  const load = useCallback(async () => {
    setError(null);
    const me = await api<{ user: { email: string; name: string | null } }>("/api/v1/auth/me");
    setUser(me.user);
    const ws = await api<{ workspaces: Workspace[] }>("/api/v1/workspaces");
    setWorkspaces(ws.workspaces);
    const active = slug ?? ws.workspaces[0]?.slug;
    if (active && !workspaceSlug) {
      onWorkspaceChange(active);
    }
    const tok = await api<{ tokens: ApiTokenMeta[] }>("/api/v1/auth/tokens");
    setTokens(tok.tokens);
    if (active) {
      const gh = await api<{ repositories: GithubRepo[] }>(
        `/api/v1/workspaces/${active}/integrations/github/repositories`,
      );
      setRepos(gh.repositories);
    }
  }, [slug, workspaceSlug, onWorkspaceChange]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
  }, [load]);

  async function runAction(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    await runAction(async () => {
      setCreatedToken(null);
      const res = await api<{ token: string; tokenMeta: ApiTokenMeta }>("/api/v1/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ name: newTokenName.trim() || "API token", scopes: ["mcp", "api"] }),
      });
      setCreatedToken(res.token);
      setTokens((prev) => [res.tokenMeta, ...prev]);
      setMessage("Token created. Copy it now — it will not be shown again.");
    });
  }

  async function revokeToken(id: string) {
    await runAction(async () => {
      await api(`/api/v1/auth/tokens/${id}`, { method: "DELETE" });
      setTokens((prev) => prev.filter((t) => t.id !== id));
    });
  }

  async function createWorkspace() {
    await runAction(async () => {
      const res = await api<{ workspace: { slug: string } }>("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({
          slug: wsSlug.trim(),
          name: wsName.trim(),
        }),
      });
      setWsSlug("");
      setWsName("");
      onWorkspaceChange(res.workspace.slug);
      await load();
      setMessage(`Workspace "${res.workspace.slug}" created.`);
    });
  }

  async function createProject() {
    if (!slug || !projectKey.trim() || !projectName.trim()) return;
    await runAction(async () => {
      await api(`/api/v1/workspaces/${slug}/projects`, {
        method: "POST",
        body: JSON.stringify({
          key: projectKey.trim().toUpperCase(),
          name: projectName.trim(),
        }),
      });
      setProjectName("");
      setMessage("Project created. Switch to the board to use it.");
    });
  }

  async function connectRepo() {
    if (!slug || !repoFullName.trim()) return;
    await runAction(async () => {
      await api(`/api/v1/workspaces/${slug}/integrations/github/repositories`, {
        method: "POST",
        body: JSON.stringify({ fullName: repoFullName.trim() }),
      });
      setRepoFullName("");
      await load();
      setMessage("Repository linked for webhook matching.");
    });
  }

  async function disconnectRepo(id: string) {
    if (!slug) return;
    await runAction(async () => {
      await api(`/api/v1/workspaces/${slug}/integrations/github/repositories/${id}`, {
        method: "DELETE",
      });
      await load();
    });
  }

  function handleSignOut() {
    clearToken();
    onSignOut();
  }

  return (
    <div className="settings">
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      {message && (
        <p style={{ color: "#86efac", margin: "0 0 1rem" }} role="status">
          {message}
        </p>
      )}
      {error && (
        <p style={{ color: "#f87171", margin: "0 0 1rem" }} role="alert">
          {error}
        </p>
      )}

      <section className="settings-section">
        <h2>Account</h2>
        {user && (
          <p style={{ margin: 0 }}>
            {user.name ? `${user.name} · ` : ""}
            {user.email}
          </p>
        )}
        <button type="button" className="btn-secondary" onClick={handleSignOut} style={{ marginTop: "0.75rem" }}>
          Sign out
        </button>
      </section>

      <section className="settings-section">
        <h2>Workspaces</h2>
        <label style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Active workspace</label>
        <select
          value={slug ?? ""}
          onChange={(e) => onWorkspaceChange(e.target.value)}
          style={{ width: "100%", maxWidth: 360, marginBottom: "1rem" }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.slug}>
              {w.name} ({w.slug}) — {w.role}
            </option>
          ))}
        </select>
        <div className="settings-grid">
          <input value={wsSlug} onChange={(e) => setWsSlug(e.target.value)} placeholder="slug (e.g. acme)" />
          <input value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Display name" />
          <button type="button" onClick={createWorkspace} disabled={busy || !wsSlug.trim() || !wsName.trim()}>
            Create workspace
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Projects</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          New projects appear in the board project selector (refresh the board view after creating).
        </p>
        <div className="settings-grid">
          <input
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            placeholder="Key (e.g. TF)"
          />
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
          <button
            type="button"
            onClick={createProject}
            disabled={busy || !slug || !projectKey.trim() || !projectName.trim()}
          >
            Create project
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>MCP &amp; API tokens</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Generate a personal access token for the TraceForge MCP server (Cursor, Claude Code, etc.). API base:{" "}
          <code>{apiUrl}</code>
        </p>
        <pre className="code-block">
{`{
  "mcpServers": {
    "traceforge": {
      "command": "pnpm",
      "args": ["--filter", "@traceforge/mcp", "start"],
      "env": {
        "TRACEFORGE_API_URL": "${apiUrl}",
        "TRACEFORGE_API_TOKEN": "<paste-token-here>"
      }
    }
  }
}`}
        </pre>
        <div className="settings-grid">
          <input value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="Token label" />
          <button type="button" onClick={createToken}>Generate token</button>
        </div>
        {createdToken && (
          <div className="token-reveal">
            <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>Copy now:</p>
            <code>{createdToken}</code>
          </div>
        )}
        <ul className="token-list">
          {tokens.map((t) => (
            <li key={t.id}>
              <span>{t.name}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{t.scopes.join(", ")}</span>
              <button type="button" className="btn-secondary" onClick={() => revokeToken(t.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>GitHub</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          OAuth UI is not required for webhooks. Register each repository below, then add a GitHub webhook pointing to:
        </p>
        <code className="code-inline">{webhookUrl}</code>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Use the same secret as <code>GITHUB_WEBHOOK_SECRET</code> on the API. Enable push, pull_request, check_run,
          and deployment_status events.
        </p>
        <div className="settings-grid">
          <input
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            placeholder="owner/repo"
          />
          <button type="button" onClick={connectRepo} disabled={!slug || !repoFullName.trim()}>
            Link repository
          </button>
        </div>
        <ul className="token-list">
          {repos.map((r) => (
            <li key={r.id}>
              <span>{r.fullName}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{r.defaultBranch}</span>
              <button type="button" className="btn-secondary" onClick={() => disconnectRepo(r.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
