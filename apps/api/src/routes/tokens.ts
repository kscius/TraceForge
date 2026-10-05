import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@traceforge/db";
import { z } from "zod";
import { randomToken, sha256 } from "../lib/crypto.js";

export const tokenRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/tokens", async (req) => {
    const user = await app.requireUser(req);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        scopes: z.array(z.string()).optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(req.body);

    const raw = `tfpat_${randomToken(32)}`;
    const token = await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: body.name,
        tokenHash: sha256(raw),
        scopes: body.scopes ?? ["mcp", "api"],
        expiresAt: body.expiresInDays
          ? new Date(Date.now() + body.expiresInDays * 86400000)
          : null,
      },
    });

    return {
      token: raw,
      tokenMeta: {
        id: token.id,
        name: token.name,
        scopes: token.scopes,
        expiresAt: token.expiresAt,
      },
      warning: "Store this token securely; it will not be shown again.",
    };
  });
};
