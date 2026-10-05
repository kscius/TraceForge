import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@traceforge/db";

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
