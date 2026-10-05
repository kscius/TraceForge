import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@traceforge/db";
import { z } from "zod";
import { randomToken, sha256 } from "../lib/crypto.js";
import { assertJwtSession, assertPatCanRead } from "../lib/pat-scopes.js";

export const tokenRoutes: FastifyPluginAsync = async (app) => {
  app.get("/auth/tokens", async (req) => {
    const user = await app.requireUser(req);
    assertPatCanRead(user);
    const tokens = await prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return { tokens };
  });

  app.delete("/auth/tokens/:tokenId", async (req, reply) => {
    const user = await app.requireUser(req);
    assertJwtSession(user);
    const { tokenId } = req.params as { tokenId: string };
    const deleted = await prisma.apiToken.deleteMany({
      where: { id: tokenId, userId: user.id },
    });
    if (deleted.count === 0) {
      return reply.status(404).send({ error: "Token not found" });
    }
    return reply.status(204).send();
  });

  app.post("/auth/tokens", async (req) => {
    const user = await app.requireUser(req);
    assertJwtSession(user);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        scopes: z.array(z.enum(["mcp", "read", "write", "api", "admin"])).optional(),
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
