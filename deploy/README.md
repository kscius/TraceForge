# Deployment layout

Committed templates live under `deploy/host.example/`. **Host-specific configuration must not be committed** (domains, TLS certs, reverse-proxy paths tied to your server).

## Production host (your server)

1. Copy the example tree to a local-only directory:

   ```bash
   cp -r deploy/host.example deploy/host
   ```

2. Edit `deploy/host/.env.production` with real secrets and your public URLs.

3. **Reverse proxy**
   - **Cloudflare Tunnel → Traefik:** ensure the external Docker network `proxy` exists and Traefik is running on the host. Set `TRACEFORGE_PUBLIC_HOST` in `.env.production`; `docker-compose.prod.yml` registers Traefik routers on that host for `/api`, `/docs`, `/health`, and the Next.js app.
   - **Direct Caddy/nginx on the host:** use loopback ports in `deploy/host/Caddyfile` (`127.0.0.1:14080` API, `:13080` web) and reload Caddy.

4. Start the stack (from repo root):

   ```bash
   pnpm deploy:prod
   ```

5. Smoke test on the server before the public URL:

   ```bash
   curl -s http://127.0.0.1:14080/health
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:13080/
   ```

`deploy/host/` is listed in `.gitignore`. Only `deploy/host.example/` is tracked.

## Local isolated development

See [docs/local-dev.md](../docs/local-dev.md) — uses `docker-compose.local.yml` and `.env.local` (also gitignored).
