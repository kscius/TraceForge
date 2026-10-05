import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@traceforge/db";
import { z } from "zod";
import { assertPatCanWrite } from "../lib/pat-scopes.js";

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/workspaces", async (req) => {
    const user = await app.requireUser(req);
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    return {
      workspaces: memberships.map((m) => ({
        ...m.workspace,
        role: m.role,
      })),
    };
  });

  app.get("/workspaces/:slug", async (req, reply) => {
    const user = await app.requireUser(req);
    const { slug } = req.params as { slug: string };
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { slug } },
      include: { workspace: true },
    });
    if (!membership) return reply.status(404).send({ error: "Workspace not found" });
    return { workspace: membership.workspace, role: membership.role };
  });

  app.post("/workspaces", async (req) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const body = z
      .object({
        slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
      })
      .parse(req.body);

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          slug: body.slug,
          name: body.name,
          description: body.description,
        },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: user.id, role: "OWNER" },
      });
      const workflow = await tx.workflowDefinition.create({
        data: {
          workspaceId: ws.id,
          name: "Default",
          isDefault: true,
          states: {
            create: [
              { key: "backlog", name: "Backlog", position: 0, color: "#64748b" },
              { key: "todo", name: "Todo", position: 1, color: "#3b82f6" },
              { key: "in_progress", name: "In Progress", position: 2, color: "#8b5cf6" },
              { key: "done", name: "Done", position: 3, color: "#22c55e", isTerminal: true },
            ],
          },
        },
        include: { states: true },
      });

      const stateByKey = new Map(workflow.states.map((s) => [s.key, s.id]));
      const transitionPairs = [
        ["backlog", "todo"],
        ["todo", "in_progress"],
        ["in_progress", "done"],
        ["todo", "done"],
      ] as const;
      for (const [from, to] of transitionPairs) {
        const fromStateId = stateByKey.get(from);
        const toStateId = stateByKey.get(to);
        if (!fromStateId || !toStateId) continue;
        await tx.workflowTransition.create({
          data: {
            workflowId: workflow.id,
            fromStateId,
            toStateId,
            name: `${from} → ${to}`,
          },
        });
      }
      await tx.project.create({
        data: {
          workspaceId: ws.id,
          workflowId: workflow.id,
          key: "TF",
          name: "Default Project",
        },
      });
      return ws;
    });

    return { workspace };
  });
};
