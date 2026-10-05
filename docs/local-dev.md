# Local development (isolated, Docker)

Use this when TraceForge shares a machine with other projects. Everything runs in Docker Compose project **`traceforge-local`** — no `pnpm dev` on the host.

| Service | Host port |
| ------- | --------- |
| Postgres | **15432** |
| API | **14000** |
| Web | **13000** |

## Start

```bash
cp .env.local.example .env.local   # first time only
pnpm dev:local
```

Demo login after first start: `demo@traceforge.local` / `demo123456`.

## Stop / logs

```bash
pnpm dev:local:down
pnpm dev:local:logs
```

## Rebuild after code changes

```bash
docker compose -f docker-compose.local.yml up -d --build
```

## Host dev (optional)

If you only need Postgres in Docker and prefer hot reload on the host, use port **15432** in `DATABASE_URL` and run `pnpm dev` yourself. The default `pnpm dev:local` path is **full Docker only**.

## Production hostname

Server-specific files (your production hostname) belong under `deploy/host/` (gitignored). Templates: `deploy/host.example/` — see [deploy/README.md](../deploy/README.md).
