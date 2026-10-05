import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import YAML from "yaml";
import { config } from "./config.js";
import { AppError, sendProblem } from "./lib/problem.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { integrationRoutes } from "./routes/integrations.js";
import { tokenRoutes } from "./routes/tokens.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: [config.webUrl, "http://localhost:3000"],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  const apiRoot = dirname(fileURLToPath(import.meta.url));
  const openApiSpec = YAML.parse(
    readFileSync(join(apiRoot, "../openapi/v1.yaml"), "utf8"),
  ) as Record<string, unknown>;

  await app.register(swagger, { openapi: openApiSpec });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => ({ status: "ready" }));

  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(tokenRoutes, { prefix: "/api/v1" });
  await app.register(workspaceRoutes, { prefix: "/api/v1" });
  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(taskRoutes, { prefix: "/api/v1" });
  await app.register(integrationRoutes, { prefix: "/api/v1" });
  await app.register(webhookRoutes, { prefix: "/api/v1" });

  app.setErrorHandler((err, req, reply) => {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.name === "ZodError") {
      const zod = error as Error & { issues?: Array<{ path: (string | number)[]; message: string }> };
      return sendProblem(
        reply,
        {
          status: 422,
          code: "validation_error",
          title: "Validation failed",
          detail: "One or more fields are invalid.",
          instance: req.url,
          errors: (zod.issues ?? []).map((issue) => ({
            pointer: `/${issue.path.join("/")}`,
            code: "invalid",
            detail: issue.message,
          })),
        },
        req,
      );
    }
    if (error instanceof AppError) {
      return sendProblem(
        reply,
        {
          status: error.statusCode,
          code: error.code,
          title: error.message,
          detail: error.message,
          instance: req.url,
        },
        req,
      );
    }
    const status = (error as Error & { statusCode?: number }).statusCode ?? 500;
    const code =
      status === 401
        ? "unauthorized"
        : status === 403
          ? "forbidden"
          : status === 404
            ? "not_found"
            : status === 409
              ? "conflict"
              : "internal_error";
    if (status >= 500) {
      req.log.error(error);
    }
    return sendProblem(
      reply,
      {
        status,
        code,
        title: status >= 500 ? "Internal server error" : error.message,
        detail: status >= 500 ? "An unexpected error occurred." : error.message,
        instance: req.url,
      },
      req,
    );
  });

  return app;
}
