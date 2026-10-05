import type { FastifyPluginAsync } from "fastify";
import { resolveRequestUser, type AuthUser } from "../lib/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    req.user = await resolveRequestUser(req);
  });

  app.decorate("requireUser", async function requireUser(req: { user: AuthUser | null }) {
    if (!req.user) {
      const err = new Error("Unauthorized");
      (err as Error & { statusCode: number }).statusCode = 401;
      throw err;
    }
    return req.user;
  });
};

declare module "fastify" {
  interface FastifyInstance {
    requireUser(req: { user: AuthUser | null }): Promise<AuthUser>;
  }
}
