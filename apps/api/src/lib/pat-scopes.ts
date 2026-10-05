import type { AuthUser } from "./auth.js";
import { AppError } from "./problem.js";

function hasScope(scopes: string[], ...allowed: string[]): boolean {
  return allowed.some((s) => scopes.includes(s));
}

/** PAT with only `read` cannot mutate; JWT has full user capabilities. */
export function assertPatCanWrite(user: AuthUser): void {
  if (user.authMethod !== "pat" || !user.tokenScopes) return;
  const scopes = user.tokenScopes;
  if (hasScope(scopes, "admin", "api", "write")) return;
  throw new AppError("Token lacks write scope", 403, "forbidden");
}

export function assertPatCanRead(user: AuthUser): void {
  if (user.authMethod !== "pat" || !user.tokenScopes) return;
  const scopes = user.tokenScopes;
  if (hasScope(scopes, "admin", "api", "read", "write", "mcp")) return;
  throw new AppError("Token lacks read scope", 403, "forbidden");
}
