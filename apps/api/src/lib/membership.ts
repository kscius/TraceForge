import { prisma, type WorkspaceRole } from "@traceforge/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { findTaskByIdentifier } from "../services/task-service.js";
import { sendProblem } from "./problem.js";

const roleRank: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasMinRole(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return roleRank[role] >= roleRank[min];
}

type TaskWithProject = Awaited<ReturnType<typeof resolveTaskByIdOrIdentifier>>;

async function resolveTaskByIdOrIdentifier(taskIdOrIdentifier: string) {
  if (taskIdOrIdentifier.includes("-")) {
    return findTaskByIdentifier(taskIdOrIdentifier);
  }
  return prisma.task.findUnique({
    where: { id: taskIdOrIdentifier },
    include: { project: true },
  });
}

export async function requireTaskAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  taskIdOrIdentifier: string,
  minRole: WorkspaceRole = "MEMBER",
): Promise<{ task: NonNullable<TaskWithProject>; role: WorkspaceRole } | null> {
  const user = req.user;
  if (!user) {
    sendProblem(
      reply,
      { status: 401, code: "unauthorized", title: "Unauthorized", detail: "Authentication required." },
      req,
    );
    return null;
  }

  const task = await resolveTaskByIdOrIdentifier(taskIdOrIdentifier);
  if (!task) {
    sendProblem(
      reply,
      {
        status: 404,
        code: "not_found",
        title: "Not found",
        detail: "Task not found.",
        instance: req.url,
      },
      req,
    );
    return null;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: task.project.workspaceId, userId: user.id },
  });
  if (!member || !hasMinRole(member.role, minRole)) {
    sendProblem(
      reply,
      {
        status: 403,
        code: "forbidden",
        title: "Forbidden",
        detail: "You do not have access to this task.",
        instance: req.url,
      },
      req,
    );
    return null;
  }

  return { task, role: member.role };
}

export async function requireProjectAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  projectId: string,
  minRole: WorkspaceRole = "MEMBER",
): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  const user = req.user;
  if (!user) {
    sendProblem(reply, { status: 401, code: "unauthorized", title: "Unauthorized" }, req);
    return null;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    sendProblem(
      reply,
      { status: 404, code: "not_found", title: "Not found", detail: "Project not found." },
      req,
    );
    return null;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId: user.id },
  });
  if (!member || !hasMinRole(member.role, minRole)) {
    sendProblem(reply, { status: 403, code: "forbidden", title: "Forbidden" }, req);
    return null;
  }

  return { workspaceId: project.workspaceId, role: member.role };
}

export async function requireWorkspaceBySlug(
  req: FastifyRequest,
  reply: FastifyReply,
  slug: string,
  minRole: WorkspaceRole = "MEMBER",
): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  const user = req.user;
  if (!user) {
    sendProblem(reply, { status: 401, code: "unauthorized", title: "Unauthorized" }, req);
    return null;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspace: { slug } },
    include: { workspace: true },
  });
  if (!member || !hasMinRole(member.role, minRole)) {
    sendProblem(
      reply,
      { status: 404, code: "not_found", title: "Not found", detail: "Workspace not found." },
      req,
    );
    return null;
  }

  return { workspaceId: member.workspaceId, role: member.role };
}
