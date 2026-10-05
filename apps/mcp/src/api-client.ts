export class TraceForgeApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  searchTasks(q: string, workspaceSlug?: string) {
    const params = new URLSearchParams({ q });
    if (workspaceSlug) params.set("workspaceSlug", workspaceSlug);
    return this.request<{ results: unknown[] }>(`/api/v1/search?${params}`);
  }

  getTask(taskId: string) {
    return this.request<{ task: unknown }>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  getAiContext(taskId: string) {
    return this.request<unknown>(`/api/v1/tasks/${encodeURIComponent(taskId)}/ai-context`);
  }

  createTask(projectId: string, body: Record<string, unknown>) {
    return this.request<{ task: unknown }>(`/api/v1/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateTask(taskId: string, body: Record<string, unknown>) {
    return this.request<{ task: unknown }>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  transitionTask(taskId: string, toStatusId: string, version?: number) {
    return this.request<{ task: unknown }>(`/api/v1/tasks/${taskId}/transition`, {
      method: "POST",
      body: JSON.stringify({ toStatusId, version }),
    });
  }

  addComment(taskId: string, body: string) {
    return this.request<{ comment: unknown }>(`/api/v1/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  linkExternal(taskId: string, body: Record<string, unknown>) {
    return this.request<{ reference: unknown }>(`/api/v1/tasks/${taskId}/external-references`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  attachUrl(taskId: string, url: string, title?: string) {
    return this.request<{ url: unknown }>(`/api/v1/tasks/${taskId}/urls`, {
      method: "POST",
      body: JSON.stringify({ url, title }),
    });
  }
}
