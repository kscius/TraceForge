FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN pnpm db:generate && pnpm build

FROM base AS api
COPY --from=build /app /app
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm db:migrate:deploy && pnpm --filter @traceforge/api start"]

FROM base AS web
COPY --from=build /app /app
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
