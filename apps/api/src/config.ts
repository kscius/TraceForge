const isProduction = process.env.NODE_ENV === "production";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env: ${name}`);
  if (isProduction && fallback !== undefined && process.env[name] === undefined) {
    throw new Error(`Missing required env in production: ${name}`);
  }
  return v;
}

export const config = {
  host: process.env.API_HOST ?? "0.0.0.0",
  port: Number.parseInt(process.env.API_PORT ?? "4000", 10),
  publicUrl: process.env.API_PUBLIC_URL ?? "http://localhost:4000",
  webUrl: process.env.WEB_PUBLIC_URL ?? "http://localhost:3000",
  sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-me"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-jwt-access-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-jwt-refresh-change-me"),
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  storageLocalPath: process.env.STORAGE_LOCAL_PATH ?? "./data/uploads",
};
