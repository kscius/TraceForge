import { prisma } from "@traceforge/db";
import { findTaskByIdentifier } from "./task-service.js";

export async function buildAiContext(taskIdOrIdentifier: string) {
  const task =
    taskIdOrIdentifier.includes("-")
      ? await findTaskByIdentifier(taskIdOrIdentifier)
      : await prisma.task.findUnique({
          where: { id: taskIdOrIdentifier },
          include: {
            project: true,
            status: true,
            assignee: true,
            labels: { include: { label: true } },
            comments: { orderBy: { createdAt: "asc" } },
            relationships: { include: { toTask: true, fromTask: true } },
            gitLinks: true,
            externalRefs: true,
            taskUrls: true,
            activity: { orderBy: { createdAt: "desc" }, take: 200 },
            subtasks: true,
          },
        });

  if (!task) return null;

  const blockers = task.relationships?.filter((r) => r.relationType === "BLOCKED_BY") ?? [];
  const dependencies = task.relationships?.filter((r) => r.relationType === "DEPENDS_ON") ?? [];
  const regressions = task.relationships?.filter((r) => r.relationType === "REGRESSION_OF") ?? [];

  const git = {
    links: task.gitLinks ?? [],
    branches: (task.gitLinks ?? []).filter((l) => l.kind === "BRANCH"),
    commits: (task.gitLinks ?? []).filter((l) => l.kind === "COMMIT"),
    pull_requests: (task.gitLinks ?? []).filter((l) => l.kind === "PULL_REQUEST"),
    deployments: (task.gitLinks ?? []).filter((l) => l.kind === "DEPLOYMENT"),
  };

  const external_references = {
    notion: (task.externalRefs ?? []).filter((r) => r.provider === "NOTION"),
    linear: (task.externalRefs ?? []).filter((r) => r.provider === "LINEAR"),
    urls: task.taskUrls ?? [],
  };

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    task: {
      id: task.id,
      identifier: task.identifier,
      title: task.title,
      description: task.description,
      content_markdown: task.contentMarkdown,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      project: task.project,
      labels: task.labels?.map((l) => l.label) ?? [],
      subtasks: task.subtasks ?? [],
    },
    requirements: {
      description: task.description,
      acceptance_criteria: extractAcceptanceCriteria(task.contentMarkdown),
    },
    relationships: {
      blockers,
      dependencies,
      regressions,
      all: task.relationships ?? [],
    },
    comments: task.comments ?? [],
    git,
    external_references,
    activity: task.activity ?? [],
    human_summary: buildHumanSummary(task),
  };
}

function extractAcceptanceCriteria(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const items: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#+\s*acceptance criteria/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^#+\s/.test(line)) break;
    if (inSection && /^[-*]\s+/.test(line)) {
      items.push(line.replace(/^[-*]\s+/, "").trim());
    }
  }
  return items;
}

function buildHumanSummary(task: {
  identifier: string;
  title: string;
  description: string | null;
  status: { name: string };
}): string {
  return `${task.identifier}: ${task.title} [${task.status.name}]${task.description ? `\n\n${task.description}` : ""}`;
}
