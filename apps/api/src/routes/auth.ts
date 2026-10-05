import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@traceforge/db";
import { loginSchema, registerSchema } from "@traceforge/shared";
import { config } from "../config.js";
import { signAccessToken } from "../lib/auth.js";

function slugFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "workspace";
  const slug = local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (slug || "workspace").slice(0, 48);
}

async function uniqueWorkspaceSlug(base: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 48);
  }
  return slug;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (req, reply) => {
    if (!config.allowRegistration) {
      return reply.status(403).send({ error: "Registration is disabled on this server" });
    }
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Unable to create account with this email" });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const displayName = body.name ?? body.email.split("@")[0] ?? "User";
    const slug = await uniqueWorkspaceSlug(slugFromEmail(body.email));

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email,
          name: displayName,
          passwordHash,
        },
      });
      const ws = await tx.workspace.create({
        data: {
          slug,
          name: `${displayName}'s Workspace`,
          description: "Personal workspace",
        },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: created.id, role: "OWNER" },
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
          name: "Main Project",
        },
      });
      return created;
    });

    const token = await signAccessToken({ id: user.id, email: user.email, name: user.name });
    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: token,
      workspace: { slug },
    });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.passwordHash) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "Invalid credentials" });
    const token = await signAccessToken({ id: user.id, email: user.email, name: user.name });
    return { user: { id: user.id, email: user.email, name: user.name }, accessToken: token };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await app.requireUser(req);
    return { user };
  });
};
