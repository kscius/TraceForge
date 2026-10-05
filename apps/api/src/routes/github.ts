import type { FastifyPluginAsync } from "fastify";
import { createHash } from "node:crypto";
import { prisma } from "@traceforge/db";
import { z } from "zod";
import { requireWorkspaceBySlug } from "../lib/membership.js";
import { assertPatCanWrite } from "../lib/pat-scopes.js";

function manualGithubRepoId(fullName: string): bigint {
  const hex = createHash("sha256").update(fullName).digest("hex").slice(0, 15);
  return BigInt(`0x${hex}`);
}

async function ensureManualConnection(userId: string) {
  const existing = await prisma.gitHubConnection.findFirst({
    where: { userId, githubLogin: "manual" },
  });
  if (existing) return existing;
  return prisma.gitHubConnection.create({
    data: {
      userId,
      githubUserId: "manual",
      githubLogin: "manual",
      accessTokenRef: "manual",
    },
  });
}

export const githubRoutes: FastifyPluginAsync = async (app) => {
  app.get("/workspaces/:slug/integrations/github/repositories", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const access = await requireWorkspaceBySlug(req, reply, slug, "MEMBER");
    if (!access) return;

    const repositories = await prisma.gitHubRepository.findMany({
      where: { workspaceId: access.workspaceId },
      orderBy: { fullName: "asc" },
    });

    return {
      repositories: repositories.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
        createdAt: r.createdAt,
      })),
    };
  });

  app.post("/workspaces/:slug/integrations/github/repositories", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const access = await requireWorkspaceBySlug(req, reply, slug, "ADMIN");
    if (!access) return;

    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const body = z
      .object({
        fullName: z
          .string()
          .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, "Use owner/repo format"),
        defaultBranch: z.string().min(1).max(120).optional(),
      })
      .parse(req.body);

    const fullName = body.fullName.trim().toLowerCase();
    const conflict = await prisma.gitHubRepository.findFirst({
      where: { fullName, workspaceId: { not: access.workspaceId } },
    });
    if (conflict) {
      return reply.status(409).send({ error: "Repository is already linked to another workspace" });
    }

    const parts = fullName.split("/");
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) {
      return reply.status(422).send({ error: "Invalid fullName" });
    }
    const connection = await ensureManualConnection(user.id);

    const repository = await prisma.gitHubRepository.upsert({
      where: {
        workspaceId_fullName: {
          workspaceId: access.workspaceId,
          fullName,
        },
      },
      create: {
        connectionId: connection.id,
        workspaceId: access.workspaceId,
        githubRepoId: manualGithubRepoId(fullName),
        owner,
        name,
        fullName,
        defaultBranch: body.defaultBranch ?? "main",
      },
      update: {
        defaultBranch: body.defaultBranch ?? "main",
      },
    });

    return reply.status(201).send({
      repository: {
        id: repository.id,
        fullName: repository.fullName,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch,
        createdAt: repository.createdAt,
      },
    });
  });

  app.delete("/workspaces/:slug/integrations/github/repositories/:repositoryId", async (req, reply) => {
    const { slug, repositoryId } = req.params as { slug: string; repositoryId: string };
    const access = await requireWorkspaceBySlug(req, reply, slug, "ADMIN");
    if (!access) return;
    const user = await app.requireUser(req);
    assertPatCanWrite(user);

    const repo = await prisma.gitHubRepository.findFirst({
      where: { id: repositoryId, workspaceId: access.workspaceId },
    });
    if (!repo) {
      return reply.status(404).send({ error: "Repository not found" });
    }

    await prisma.gitHubRepository.delete({ where: { id: repo.id } });
    return reply.status(204).send();
  });
};
