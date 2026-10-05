import type { UrlKind } from "@traceforge/db";

export function classifyUrl(url: string): UrlKind {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname;

    if (host === "github.com") {
      if (/\/pull\/\d+/.test(path)) return "GITHUB_PR";
      if (/\/commit\//.test(path)) return "GITHUB_COMMIT";
      if (/\/issues\/\d+/.test(path)) return "GITHUB_ISSUE";
      if (/\/tree\//.test(path)) return "GITHUB_BRANCH";
    }
    if (host === "notion.so" || host.endsWith(".notion.site")) return "NOTION_PAGE";
    if (host === "linear.app") return "LINEAR_ISSUE";
    if (/vercel\.com|netlify\.app|render\.com/.test(host)) return "DEPLOYMENT";
    if (/docs\.|readme|wiki/i.test(path)) return "DOCUMENTATION";
  } catch {
    return "GENERIC";
  }
  return "GENERIC";
}
