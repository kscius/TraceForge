# Self-hosting TraceForge

## Local isolated development

On a machine that already runs other apps on 5432/3000/4000, see [local-dev.md](./local-dev.md).

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit secrets in .env for production

docker compose up -d db
pnpm install
pnpm db:generate
export DATABASE_URL=postgresql://traceforge:traceforge@localhost:5432/traceforge
pnpm db:migrate
pnpm db:seed

pnpm dev
```

- Web UI: http://localhost:3000
- API: http://localhost:4000
- OpenAPI UI: http://localhost:4000/docs

Demo login after seed:

- Email: `demo@traceforge.local`
- Password: `demo123456`

## Production notes

- Set strong `SESSION_SECRET`, `JWT_*` values.
- Use external PostgreSQL and S3-compatible object storage (`STORAGE_DRIVER=s3`) for attachments.
- Put API behind TLS reverse proxy.
- Configure `GITHUB_WEBHOOK_SECRET` and point GitHub webhooks to `/api/v1/webhooks/github`.

## Backups

- Backup PostgreSQL regularly (`pg_dump`).
- Backup object storage bucket if using S3/MinIO.

## Upgrades

1. Backup database.
2. Pull new image / code.
3. Run `pnpm db:migrate:deploy`.
4. Restart API and web services.
