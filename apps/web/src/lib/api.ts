const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("traceforge_token");
}

export function setToken(token: string) {
  localStorage.setItem("traceforge_token", token);
}

export function clearToken() {
  localStorage.removeItem("traceforge_token");
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { error?: string; detail?: string; title?: string };
    return json.error ?? json.detail ?? json.title ?? text;
  } catch {
    return text || res.statusText;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) {
    return undefined as T;
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<T>;
}

export function getApiPublicUrl(): string {
  return API_URL;
}
