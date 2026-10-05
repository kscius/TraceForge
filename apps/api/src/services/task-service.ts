import {
  AuditSource,
  prisma,
  type Task,
  type TaskPriority,
} from "@traceforge/db";
import { WorkflowEngine, formatTaskIdentifier, parseTaskIdentifier } from "@traceforge/domain";
import { recordAudit } from "../lib/audit.js";

export async function getNextTaskNumber(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function loadWorkflowEngine(workflowId: string): Promise<WorkflowEngine> {
  const [states, transitions] = await Promise.all([
    prisma.workflowState.findMany({ where: { workflowId } }),
    prisma.workflowTransition.findMany({ where: { workflowId } }),
  ]);
  return new WorkflowEngine(
    states.map((s) => ({ id: s.id, key: s.key, isTerminal: s.isTerminal })),
    transitions.map((t) => ({ fromStateId: t.fromStateId, toStateId: t.toStateId })),
  );
}

export async function createTask(input: {
  projectId: string;
  creatorId: string;
  title: string;
  description?: string;
  contentMarkdown?: string;
  priority?: TaskPriority;
  typeId?: string;
  assigneeId?: string;
  parentId?: string;
  labelIds?: string[];
  source: AuditSource;
}): Promise<Task> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { workflow: { include: { states: { orderBy: { position: "asc" } } } } },
  });
  const defaultState =
    project.workflow.states.find((s) => s.key === "backlog") ??
    project.workflow.states.find((s) => s.key === "todo") ??
    project.workflow.states[0];
  if (!defaultState) throw new Error("Workflow has no states");

  const number = await getNextTaskNumber(project.id);
  const identifier = formatTaskIdentifier(project.key, number);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId: project.id,
        number,
        identifier,
        title: input.title,
        description: input.description,
        contentMarkdown: input.contentMarkdown,
        statusId: defaultState.id,
        priority: input.priority ?? "NONE",
        typeId: input.typeId,
        assigneeId: input.assigneeId,
        parentId: input.parentId,
        creatorId: input.creatorId,
      },
    });

    if (input.labelIds?.length) {
      await tx.taskLabel.createMany({
        data: input.labelIds.map((labelId) => ({ taskId: created.id, labelId })),
        skipDuplicates: true,
      });
    }

    await tx.activityEvent.create({
      data: {
        taskId: created.id,
        type: "task.created",
        summary: `Task ${identifier} created`,
      },
    });

    return created;
  });

  await recordAudit({
    workspaceId: project.workspaceId,
    entityType: "task",
    entityId: task.id,
    action: "create",
    actorUserId: input.creatorId,
    source: input.source,
    newValue: { identifier, title: task.title },
  });

  return task;
}

export async function transitionTask(input: {
  taskId: string;
  toStatusId: string;
  actorUserId: string;
  source: AuditSource;
  expectedVersion?: number;
}): Promise<Task> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    include: { project: true },
  });

  if (input.expectedVersion !== undefined && task.version !== input.expectedVersion) {
    const err = new Error("Task version conflict");
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }

  const engine = await loadWorkflowEngine(task.project.workflowId);
  if (!engine.canTransition(task.statusId, input.toStatusId)) {
    const err = new Error("Transition not allowed");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.task.update({
      where: { id: task.id },
      data: {
        statusId: input.toStatusId,
        version: { increment: 1 },
        completedAt: engine.isTerminal(input.toStatusId) ? new Date() : null,
      },
    });
    await tx.activityEvent.create({
      data: {
        taskId: task.id,
        type: "task.transitioned",
        summary: "Task status changed",
        payload: { fromStatusId: task.statusId, toStatusId: input.toStatusId },
      },
    });
    return next;
  });

  await recordAudit({
    workspaceId: task.project.workspaceId,
    entityType: "task",
    entityId: task.id,
    action: "transition",
    actorUserId: input.actorUserId,
    source: input.source,
    previousValue: { statusId: task.statusId },
    newValue: { statusId: input.toStatusId },
  });

  return updated;
}

export async function findTaskByIdentifier(identifier: string) {
  const parsed = parseTaskIdentifier(identifier);
  if (!parsed) return null;
  return prisma.task.findFirst({
    where: {
      identifier: identifier.toUpperCase(),
      project: { key: parsed.projectKey },
    },
    include: {
      project: true,
      status: true,
      assignee: true,
      labels: { include: { label: true } },
      comments: { orderBy: { createdAt: "asc" }, take: 50 },
      relationships: { include: { toTask: true, fromTask: true } },
      subtasks: true,
      gitLinks: true,
      externalRefs: true,
      taskUrls: true,
      activity: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}
