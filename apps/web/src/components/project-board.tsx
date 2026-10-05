"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type WorkflowState = { id: string; key: string; name: string; color: string };
type Task = {
  id: string;
  identifier: string;
  title: string;
  statusId: string;
  position: number;
  priority: string;
  assignee?: { name: string | null; email: string } | null;
};

type Project = {
  id: string;
  name: string;
  key: string;
  workflow: { states: WorkflowState[] };
};

type ProjectBoardProps = {
  workspaceSlug: string | null;
  onWorkspaceSlug: (slug: string) => void;
};

export function ProjectBoard({ workspaceSlug, onWorkspaceSlug }: ProjectBoardProps) {
  const [workspaces, setWorkspaces] = useState<{ slug: string; name: string }[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(workspaceSlug);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [newTitle, setNewTitle] = useState("");

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  );

  const load = useCallback(async () => {
    const ws = await api<{ workspaces: { slug: string; name: string }[] }>("/api/v1/workspaces");
    setWorkspaces(ws.workspaces);
    const slug = activeSlug ?? workspaceSlug ?? ws.workspaces[0]?.slug;
    if (!slug) {
      setProjects([]);
      setTasks([]);
      return;
    }
    if (slug !== workspaceSlug) {
      onWorkspaceSlug(slug);
    }
    const { projects: ps } = await api<{ projects: Project[] }>(
      `/api/v1/workspaces/${slug}/projects`,
    );
    setProjects(ps);
    const pid = projectId && ps.some((p) => p.id === projectId) ? projectId : ps[0]?.id;
    if (!pid) {
      setProjectId(null);
      setTasks([]);
      return;
    }
    setProjectId(pid);
    const { tasks: t } = await api<{ tasks: Task[] }>(`/api/v1/projects/${pid}/tasks`);
    setTasks(t);
  }, [projectId, activeSlug, workspaceSlug, onWorkspaceSlug]);

  useEffect(() => {
    if (workspaceSlug && workspaceSlug !== activeSlug) {
      setActiveSlug(workspaceSlug);
    }
  }, [workspaceSlug, activeSlug]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function createTask() {
    if (!project || !newTitle.trim()) return;
    await api(`/api/v1/projects/${project.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    setNewTitle("");
    await load();
  }

  async function transition(task: Task, toStatusId: string) {
    await api(`/api/v1/tasks/${task.id}/transition`, {
      method: "POST",
      body: JSON.stringify({ toStatusId }),
    });
    await load();
  }

  const states = project?.workflow.states ?? [];

  const workspaceName =
    workspaces.find((w) => w.slug === (activeSlug ?? workspaceSlug))?.name ?? activeSlug ?? "—";

  return (
    <div className="board-layout">
      <aside className="board-sidebar">
        <label style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Workspace</label>
        <select
          value={activeSlug ?? workspaceSlug ?? ""}
          onChange={(e) => {
            setProjectId(null);
            setActiveSlug(e.target.value);
            onWorkspaceSlug(e.target.value);
          }}
          style={{ width: "100%", maxWidth: 320, marginBottom: "0.75rem" }}
        >
          {workspaces.map((w) => (
            <option key={w.slug} value={w.slug}>
              {w.name}
            </option>
          ))}
        </select>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 0 }}>{workspaceName}</p>
        <label style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Project</label>
        <select
          value={project?.id ?? ""}
          onChange={(e) => setProjectId(e.target.value)}
          style={{ width: "100%", marginBottom: "1rem" }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <input
            placeholder="New task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="button" onClick={createTask}>Create task</button>
        </div>
      </aside>
      <div className="board-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>{project?.name ?? "Project"}</h1>
          <div className="tabs">
            <button className={`tab ${view === "kanban" ? "active" : ""}`} onClick={() => setView("kanban")}>
              Kanban
            </button>
            <button className={`tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
              List
            </button>
          </div>
        </div>

        {view === "kanban" ? (
          <div className="kanban" style={{ marginTop: "1rem" }}>
            {states.map((state) => {
              const columnTasks = tasks
                .filter((t) => t.statusId === state.id)
                .sort((a, b) => a.position - b.position);
              return (
                <section key={state.id} className="column">
                  <header className="column-header">
                    <span>{state.name}</span>
                    <span style={{ color: "var(--muted)" }}>{columnTasks.length}</span>
                  </header>
                  <div className="column-body">
                    {columnTasks.map((task) => (
                      <article key={task.id} className="card">
                        <div className="card-id">{task.identifier}</div>
                        <div>{task.title}</div>
                        <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {states
                            .filter((s) => s.id !== task.statusId)
                            .slice(0, 3)
                            .map((s) => (
                              <button
                                key={s.id}
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                                onClick={() => transition(task, s.id)}
                              >
                                → {s.name}
                              </button>
                            ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <table className="list-table" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.identifier}</td>
                  <td>{task.title}</td>
                  <td>{states.find((s) => s.id === task.statusId)?.name}</td>
                  <td>{task.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
