import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@traceforge/db";
import { z } from "zod";
import { requireWorkspaceBySlug } from "../lib/membership.js";
import { assertPatCanWrite } from "../lib/pat-scopes.js";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/workspaces/:slug/projects", async (req, reply) => {
    const user = await app.requireUser(req);
    const { slug } = req.params as { slug: string };
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { slug } },
    });
    if (!membership) return reply.status(404).send({ error: "Workspace not found" });

    const projects = await prisma.project.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: "asc" },
      include: {
        workflow: { include: { states: { orderBy: { position: "asc" } } } },
      },
    });
    return { projects };
  });

  app.post("/workspaces/:slug/projects", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const access = await requireWorkspaceBySlug(req, reply, slug, "ADMIN");
    if (!access) return;
    const user = await app.requireUser(req);
    assertPatCanWrite(user);

    const body = z
      .object({
        key: z
          .string()
          .min(2)
          .max(12)
          .regex(/^[A-Z][A-Z0-9]*$/),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
      })
      .parse(req.body);

    const workflow = await prisma.workflowDefinition.findFirst({
      where: { workspaceId: access.workspaceId, isDefault: true },
      include: { states: true },
    });
    if (!workflow) {
      return reply.status(422).send({ error: "Workspace has no default workflow" });
    }

    const project = await prisma.project.create({
      data: {
        workspaceId: access.workspaceId,
        workflowId: workflow.id,
        key: body.key,
        name: body.name,
        description: body.description,
      },
      include: {
        workflow: { include: { states: { orderBy: { position: "asc" } } } },
      },
    });

    return reply.status(201).send({ project });
  });

  app.get("/projects/:projectId", async (req, reply) => {
    const user = await app.requireUser(req);
    const { projectId } = req.params as { projectId: string };
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workflow: { include: { states: { orderBy: { position: "asc" } } } },
        kanbanBoards: { include: { columns: { orderBy: { position: "asc" } } } },
      },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId, userId: user.id },
    });
    if (!member) return reply.status(403).send({ error: "Forbidden" });

    return { project };
  });
};
