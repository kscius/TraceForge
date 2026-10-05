import type { FastifyPluginAsync } from "fastify";
import { AuditSource, prisma, type TaskPriority } from "@traceforge/db";
import {
  attachUrlSchema,
  createCommentSchema,
  createTaskSchema,
  linkTasksSchema,
  transitionTaskSchema,
  updateTaskSchema,
} from "@traceforge/shared";
import { recordAudit } from "../lib/audit.js";
import { requireProjectAccess, requireTaskAccess } from "../lib/membership.js";
import { assertPatCanRead, assertPatCanWrite } from "../lib/pat-scopes.js";
import { sendProblem } from "../lib/problem.js";
import { buildAiContext } from "../services/ai-context.js";
import { createTask, transitionTask } from "../services/task-service.js";
import { classifyUrl } from "../lib/url-classifier.js";

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects/:projectId/tasks", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanRead(user);
    const { projectId } = req.params as { projectId: string };
    const query = req.query as { statusId?: string; q?: string };

    const access = await requireProjectAccess(req, reply, projectId, "VIEWER");
    if (!access) return;

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        statusId: query.statusId,
        OR: query.q
          ? [
              { title: { contains: query.q, mode: "insensitive" } },
              { identifier: { contains: query.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ statusId: "asc" }, { position: "asc" }],
      include: {
        status: true,
        assignee: true,
        labels: { include: { label: true } },
        type: true,
      },
    });
    return { tasks };
  });

  app.post("/projects/:projectId/tasks", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { projectId } = req.params as { projectId: string };
    const body = createTaskSchema.parse(req.body);

    const access = await requireProjectAccess(req, reply, projectId, "MEMBER");
    if (!access) return;

    const task = await createTask({
      projectId,
      creatorId: user.id,
      title: body.title,
      description: body.description,
      contentMarkdown: body.contentMarkdown,
      priority: body.priority as TaskPriority | undefined,
      typeId: body.typeId,
      assigneeId: body.assigneeId,
      parentId: body.parentId,
      labelIds: body.labelIds,
      source: AuditSource.API,
    });
    return { task };
  });

  app.get("/tasks/:taskId", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanRead(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "VIEWER");
    if (!access) return;

    const task = await prisma.task.findUnique({
      where: { id: access.task.id },
      include: {
        project: true,
        status: true,
        assignee: true,
        labels: { include: { label: true } },
        comments: { orderBy: { createdAt: "asc" } },
        relationships: { include: { toTask: true, fromTask: true } },
        gitLinks: true,
        taskUrls: true,
        activity: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    return { task };
  });

  app.patch("/tasks/:taskId", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const body = updateTaskSchema.parse(req.body);

    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    const existing = access.task;

    if (body.version !== undefined && body.version !== existing.version) {
      return sendProblem(
        reply,
        {
          status: 409,
          code: "version_conflict",
          title: "Version conflict",
          detail: "Task was modified elsewhere. Refresh and retry.",
        },
        req,
      );
    }

    const { labelIds, version: _v, ...data } = body;
    const task = await prisma.task.update({
      where: { id: existing.id },
      data: { ...data, version: { increment: 1 } },
    });

    if (labelIds) {
      await prisma.taskLabel.deleteMany({ where: { taskId: existing.id } });
      await prisma.taskLabel.createMany({
        data: labelIds.map((labelId) => ({ taskId: existing.id, labelId })),
      });
    }

    await recordAudit({
      workspaceId: existing.project.workspaceId,
      entityType: "task",
      entityId: existing.id,
      action: "update",
      actorUserId: user.id,
      source: AuditSource.API,
      newValue: body,
    });

    return { task };
  });

  app.post("/tasks/:taskId/transition", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const body = transitionTaskSchema.parse(req.body);
    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    try {
      const task = await transitionTask({
        taskId: access.task.id,
        toStatusId: body.toStatusId,
        actorUserId: user.id,
        source: AuditSource.API,
        expectedVersion: body.version,
      });
      return { task };
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      const status = err.statusCode ?? 500;
      const code =
        status === 409 ? "version_conflict" : status === 400 ? "illegal_transition" : "internal_error";
      return sendProblem(
        reply,
        {
          status,
          code,
          title: err.message,
          detail: err.message,
        },
        req,
      );
    }
  });

  app.get("/tasks/:taskId/comments", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanRead(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "VIEWER");
    if (!access) return;
    const comments = await prisma.comment.findMany({
      where: { taskId: access.task.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return { comments };
  });

  app.post("/tasks/:taskId/comments", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    const body = createCommentSchema.parse(req.body);
    const comment = await prisma.comment.create({
      data: { taskId: access.task.id, authorId: user.id, body: body.body },
    });
    await prisma.activityEvent.create({
      data: { taskId: access.task.id, type: "comment.added", summary: "Comment added" },
    });
    return { comment };
  });

  app.post("/tasks/:taskId/links", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    const body = linkTasksSchema.parse(req.body);
    const rel = await prisma.taskRelationship.create({
      data: {
        fromTaskId: access.task.id,
        toTaskId: body.toTaskId,
        relationType: body.relationType,
      },
    });
    await recordAudit({
      entityType: "task_relationship",
      entityId: rel.id,
      action: "create",
      actorUserId: user.id,
      source: AuditSource.API,
      newValue: body,
    });
    return { relationship: rel };
  });

  app.post("/tasks/:taskId/urls", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanWrite(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "MEMBER");
    if (!access) return;
    const body = attachUrlSchema.parse(req.body);
    const kind = classifyUrl(body.url);
    const url = await prisma.taskUrl.create({
      data: { taskId: access.task.id, url: body.url, title: body.title, kind },
    });
    await recordAudit({
      entityType: "task_url",
      entityId: url.id,
      action: "create",
      actorUserId: user.id,
      source: AuditSource.API,
      newValue: { url: body.url, kind },
    });
    return { url };
  });

  app.get("/tasks/:taskId/ai-context", async (req, reply) => {
    const user = await app.requireUser(req);
    assertPatCanRead(user);
    const { taskId } = req.params as { taskId: string };
    const access = await requireTaskAccess(req, reply, taskId, "VIEWER");
    if (!access) return;
    const ctx = await buildAiContext(access.task.id);
    if (!ctx) {
      return sendProblem(
        reply,
        { status: 404, code: "not_found", title: "Not found", detail: "Task not found." },
        req,
      );
    }
    return ctx;
  });

  app.get("/search", async (req) => {
    const user = await app.requireUser(req);
    const { q, workspaceSlug } = req.query as { q?: string; workspaceSlug?: string };
    if (!q || q.length < 2) return { results: [] };

    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: user.id,
        workspace: workspaceSlug ? { slug: workspaceSlug } : undefined,
      },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const tasks = await prisma.task.findMany({
      where: {
        project: { workspaceId: { in: workspaceIds } },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { identifier: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 50,
      include: { project: true, status: true },
    });
    return { results: tasks };
  });
};
