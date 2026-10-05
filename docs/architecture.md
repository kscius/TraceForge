# TraceForge Architecture

## Product identity

- **Recommended product name:** **TraceForge** (repo already uses this; avoids crowded **TaskForge** npm/GitHub names while keeping **TF-** task identifiers).
- **Recommended GitHub org/repo:** `traceforgehq/traceforge` or `traceforge/traceforge`.

## Monorepo layout

```text
apps/
  api/     Fastify REST + OpenAPI + webhooks
  web/     Next.js developer UI (Kanban, list)
  mcp/     MCP stdio server for Cursor / Claude Code
packages/
  db/      Prisma schema + client
  domain/  Workflow engine, task ID parsing (vendor-free)
  shared/  Zod API schemas
docs/      Architecture, MCP, self-hosting
```

## Domain boundaries

| Layer | Responsibility |
| ----- | -------------- |
| `packages/domain` | Workflow transitions, task identifier rules, git text parsing |
| `packages/db` | Persistence, referential integrity |
| `apps/api` | HTTP auth, authorization, audit, integration adapters |
| `apps/mcp` | Thin MCP tool surface over REST (AI-first clients) |

Integration-specific logic stays in API service modules (`github-webhook`, future `notion/*`, `linear/*`) and maps into core tables (`TaskGitLink`, `ExternalReference`).

## Workflow engine

Workflows are **per workspace**, with `WorkflowState`, `WorkflowTransition`, and optional `KanbanColumn` mappings. State changes go through `WorkflowEngine.canTransition()` — automations (Phase 5) will call the same path.

## AI context

`GET /api/v1/tasks/:id/ai-context` returns `schema_version: "1.0"` JSON optimized for LLM consumption: task, requirements, relationships, comments, git links, external references, activity.

MCP tool `get_ai_context` proxies this endpoint.

## Git traceability

Association paths:

1. **Heuristic:** parse `TF-123` from branch, commit message, PR title/body (webhook handlers).
2. **Explicit:** REST/MCP link APIs and classified URLs.
3. **Stored:** `TaskGitLink` + normalized GitHub tables for Phase 2 enrichment.

## Security model (MVP)

- JWT access tokens (15m) + personal API tokens (SHA-256 hashed at rest).
- Workspace membership checks on project/task routes.
- GitHub webhooks: HMAC SHA-256 when `GITHUB_WEBHOOK_SECRET` is set.
- Rate limiting on API.
- URL attachment uses client-provided URLs only (SSRF-safe fetch deferred to sync jobs).

## Self-hosting

`docker-compose.yml` runs PostgreSQL, API, and Web. API runs migrations on startup in the container image.

## Phased delivery

See root `README.md` roadmap. Current implementation targets **Phase 1 core** + **Phase 2 webhook linking skeleton** + **Phase 3 MCP** foundation.
