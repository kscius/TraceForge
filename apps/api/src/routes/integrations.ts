import type { FastifyPluginAsync } from "fastify";
import { AuditSource, IntegrationProvider, prisma, type Prisma } from "@traceforge/db";
import { z } from "zod";
import { recordAudit } from "../lib/audit.js";
import { requireTaskAccess } from "../lib/membership.js";
import { assertPatCanWrite } from "../lib/pat-scopes.js";

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/tasks/:taskId/external-references", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    const body = z
      .object({
        provider: z.enum(["NOTION", "LINEAR", "GITHUB", "JIRA"]),
        externalId: z.string().min(1),
        externalKey: z.string().optional(),
        title: z.string().optional(),
        url: z.string().url().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const task = access.task;

    const ref = await prisma.externalReference.upsert({
      where: {
        taskId_provider_externalId: {
          taskId: task.id,
          provider: body.provider as IntegrationProvider,
          externalId: body.externalId,
        },
      },
      create: {
        taskId: task.id,
        provider: body.provider as IntegrationProvider,
        externalId: body.externalId,
        externalKey: body.externalKey,
        title: body.title,
        url: body.url,
        metadata: body.metadata as unknown as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      update: {
        externalKey: body.externalKey,
        title: body.title,
        url: body.url,
        metadata: body.metadata as unknown as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });

    await recordAudit({
      workspaceId: task.project.workspaceId,
      entityType: "external_reference",
      entityId: ref.id,
      action: "link",
      actorUserId: user.id,
      source: AuditSource.API,
      newValue: body,
    });

    return { reference: ref };
  });
};
