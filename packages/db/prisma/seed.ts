import { PrismaClient, TaskPriority, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_STATES = [
  { key: "backlog", name: "Backlog", category: "backlog", color: "#64748b", position: 0 },
  { key: "todo", name: "Todo", category: "active", color: "#3b82f6", position: 1 },
  { key: "in_progress", name: "In Progress", category: "active", color: "#8b5cf6", position: 2 },
  { key: "blocked", name: "Blocked", category: "active", color: "#ef4444", position: 3 },
  { key: "in_review", name: "In Review", category: "active", color: "#f59e0b", position: 4 },
  { key: "tested", name: "Tested", category: "active", color: "#10b981", position: 5 },
  { key: "done", name: "Done", category: "done", color: "#22c55e", position: 6, isTerminal: true },
  { key: "cancelled", name: "Cancelled", category: "cancelled", color: "#94a3b8", position: 7, isTerminal: true },
];

const TASK_TYPES = [
  { key: "feature", name: "Feature", color: "#3b82f6" },
  { key: "bug", name: "Bug", color: "#ef4444" },
  { key: "chore", name: "Chore", color: "#94a3b8" },
  { key: "epic", name: "Epic", color: "#8b5cf6" },
];

function seedDemoEnabled(): boolean {
  const flag = process.env.SEED_DEMO_DATA?.toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

async function bootstrapAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  const name = process.env.SEED_ADMIN_NAME?.trim() || email.split("@")[0];
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "main";
  const slug = slugBase.slice(0, 48);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash },
  });

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  });
  if (existingMember) {
    console.log("Bootstrap admin workspace already exists.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        slug,
        name: `${name}'s Workspace`,
        description: "Primary workspace",
      },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: ws.id, userId: user.id, role: WorkspaceRole.OWNER },
    });
    const workflow = await tx.workflowDefinition.create({
      data: {
        workspaceId: ws.id,
        name: "Software Delivery",
        isDefault: true,
        states: { create: DEFAULT_STATES.map((s) => ({ ...s, isTerminal: s.isTerminal ?? false })) },
      },
      include: { states: true },
    });
    await tx.project.create({
      data: {
        workspaceId: ws.id,
        workflowId: workflow.id,
        key: "TF",
        name: "Main Project",
      },
    });
  });

  console.log(`Bootstrap admin workspace created (slug: ${slug}).`);
}

async function seedDemo() {
  const passwordHash = await bcrypt.hash("demo123456", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@traceforge.local" },
    update: {},
    create: {
      email: "demo@traceforge.local",
      name: "Demo User",
      passwordHash,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo Workspace",
      description: "Sample workspace for local development",
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  let workflow = await prisma.workflowDefinition.findFirst({
    where: { workspaceId: workspace.id, isDefault: true },
  });

  if (!workflow) {
    workflow = await prisma.workflowDefinition.create({
      data: {
        workspaceId: workspace.id,
        name: "Software Delivery",
        isDefault: true,
        states: {
          create: DEFAULT_STATES.map((s) => ({
            key: s.key,
            name: s.name,
            category: s.category,
            color: s.color,
            position: s.position,
            isTerminal: s.isTerminal ?? false,
          })),
        },
      },
      include: { states: true },
    });

    const stateByKey = new Map(workflow.states.map((s) => [s.key, s.id]));
    const transitions = [
      ["backlog", "todo"],
      ["todo", "in_progress"],
      ["in_progress", "blocked"],
      ["blocked", "in_progress"],
      ["in_progress", "in_review"],
      ["in_review", "in_progress"],
      ["in_review", "tested"],
      ["tested", "done"],
      ["todo", "cancelled"],
      ["in_progress", "cancelled"],
    ] as const;

    for (const [from, to] of transitions) {
      const fromStateId = stateByKey.get(from);
      const toStateId = stateByKey.get(to);
      if (!fromStateId || !toStateId) continue;
      await prisma.workflowTransition.create({
        data: {
          workflowId: workflow.id,
          fromStateId,
          toStateId,
          name: `${from} → ${to}`,
        },
      });
    }
  }

  for (const t of TASK_TYPES) {
    await prisma.taskTypeDefinition.upsert({
      where: { workspaceId_key: { workspaceId: workspace.id, key: t.key } },
      update: {},
      create: { workspaceId: workspace.id, ...t },
    });
  }

  const labels = ["backend", "frontend", "mcp", "github"];
  for (const name of labels) {
    await prisma.label.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name } },
      update: {},
      create: { workspaceId: workspace.id, name, color: "#6366f1" },
    });
  }

  const project = await prisma.project.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: "TF" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      workflowId: workflow.id,
      key: "TF",
      name: "TraceForge Core",
      description: "Core platform development",
      color: "#6366f1",
    },
  });

  const todoState = await prisma.workflowState.findFirst({
    where: { workflowId: workflow.id, key: "todo" },
  });
  const inProgress = await prisma.workflowState.findFirst({
    where: { workflowId: workflow.id, key: "in_progress" },
  });
  const featureType = await prisma.taskTypeDefinition.findFirst({
    where: { workspaceId: workspace.id, key: "feature" },
  });

  if (todoState && inProgress && featureType) {
    await prisma.task.upsert({
      where: { identifier: "TF-1" },
      update: {},
      create: {
        projectId: project.id,
        number: 1,
        identifier: "TF-1",
        title: "Bootstrap TraceForge monorepo",
        description: "Initial monorepo, API, web UI, and MCP server scaffold.",
        statusId: inProgress.id,
        priority: TaskPriority.HIGH,
        typeId: featureType.id,
        creatorId: user.id,
        assigneeId: user.id,
        position: 0,
      },
    });

    await prisma.task.upsert({
      where: { identifier: "TF-2" },
      update: {},
      create: {
        projectId: project.id,
        number: 2,
        identifier: "TF-2",
        title: "Connect GitHub repository",
        description: "OAuth, webhooks, and task↔PR association.",
        statusId: todoState.id,
        priority: TaskPriority.MEDIUM,
        typeId: featureType.id,
        creatorId: user.id,
        position: 1,
      },
    });
  }

  const board = await prisma.kanbanBoard.findFirst({ where: { projectId: project.id } });
  if (!board) {
    const states = await prisma.workflowState.findMany({
      where: { workflowId: workflow.id },
      orderBy: { position: "asc" },
    });
    await prisma.kanbanBoard.create({
      data: {
        projectId: project.id,
        name: "Delivery Board",
        columns: {
          create: states.map((s, i) => ({
            workflowStateId: s.id,
            position: i,
            wipLimit: s.key === "in_progress" ? 5 : null,
          })),
        },
      },
    });
  }

  console.log("Demo seed complete:");
  console.log("  Email: demo@traceforge.local");
  console.log("  Password: demo123456");
  console.log("  Workspace: demo");
  console.log("  Project: TF");
}

async function main() {
  await bootstrapAdmin();
  if (seedDemoEnabled()) {
    await seedDemo();
  } else {
    console.log("Demo seed skipped (set SEED_DEMO_DATA=true to enable).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
