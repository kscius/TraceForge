import { createHmac, timingSafeEqual } from "node:crypto";
import { AuditSource, GitLinkKind, prisma, type Prisma } from "@traceforge/db";
import { extractTaskIdentifiers } from "@traceforge/domain";
import { config } from "../config.js";
import { recordAudit } from "../lib/audit.js";

export function verifyGithubSignature(payload: string, signature: string | undefined): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || config.githubWebhookSecret;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signature.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function handleGithubWebhook(event: string, body: Record<string, unknown>) {
  if (event === "pull_request") {
    await handlePullRequest(body);
  } else if (event === "push") {
    await handlePush(body);
  } else if (event === "check_run") {
    await handleCheckRun(body);
  } else if (event === "deployment_status") {
    await handleDeploymentStatus(body);
  }
}

async function workspaceIdForRepo(fullName: string): Promise<string | null> {
  const repo = await prisma.gitHubRepository.findFirst({
    where: { fullName },
    select: { workspaceId: true },
  });
  return repo?.workspaceId ?? null;
}

async function linkTasksFromText(
  text: string,
  workspaceId: string | null,
  link: {
  kind: GitLinkKind;
  externalKey: string;
  title?: string;
  url?: string;
  metadata?: Prisma.InputJsonValue;
  },
) {
  if (!workspaceId) return;
  const identifiers = extractTaskIdentifiers(text);
  for (const identifier of identifiers) {
    const task = await prisma.task.findFirst({
      where: {
        identifier: identifier.toUpperCase(),
        project: { workspaceId },
      },
    });
    if (!task) continue;
    const existing = await prisma.taskGitLink.findFirst({
      where: {
        taskId: task.id,
        kind: link.kind,
        externalKey: link.externalKey,
      },
    });
    if (existing) {
      await prisma.taskGitLink.update({
        where: { id: existing.id },
        data: {
          title: link.title,
          url: link.url,
          metadata: link.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } else {
      await prisma.taskGitLink.create({
        data: {
          taskId: task.id,
          kind: link.kind,
          externalKey: link.externalKey,
          title: link.title,
          url: link.url,
          metadata: link.metadata as Prisma.InputJsonValue | undefined,
          source: AuditSource.GITHUB_WEBHOOK,
        },
      });
    }

    await prisma.activityEvent.create({
      data: {
        taskId: task.id,
        type: "github.linked",
        summary: `Linked ${link.kind} ${link.externalKey}`,
        payload: link.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

async function handlePullRequest(body: Record<string, unknown>) {
  const pr = body.pull_request as Record<string, unknown> | undefined;
  const repo = (body.repository as Record<string, unknown>)?.full_name as string | undefined;
  if (!pr || !repo) return;

  const number = String(pr.number);
  const title = String(pr.title ?? "");
  const htmlUrl = String(pr.html_url ?? "");
  const headRef = (pr.head as Record<string, unknown>)?.ref as string | undefined;
  const text = [title, pr.body, headRef].filter(Boolean).join("\n");
  const workspaceId = await workspaceIdForRepo(repo);

  await linkTasksFromText(text, workspaceId, {
    kind: GitLinkKind.PULL_REQUEST,
    externalKey: `${repo}#${number}`,
    title,
    url: htmlUrl,
    metadata: { state: pr.state, merged: pr.merged_at, repo } as Prisma.InputJsonValue,
  });
}

async function handlePush(body: Record<string, unknown>) {
  const repo = (body.repository as Record<string, unknown>)?.full_name as string | undefined;
  const ref = String(body.ref ?? "");
  const branch = ref.replace(/^refs\/heads\//, "");
  const commits = (body.commits as Array<Record<string, unknown>>) ?? [];

  const workspaceId = repo ? await workspaceIdForRepo(repo) : null;

  if (repo && branch) {
    await linkTasksFromText(branch, workspaceId, {
      kind: GitLinkKind.BRANCH,
      externalKey: `${repo}:${branch}`,
      title: branch,
      metadata: { repo } as Prisma.InputJsonValue,
    });
  }

  for (const commit of commits) {
    const sha = String(commit.id ?? "");
    const message = String(commit.message ?? "");
    const url = String(commit.url ?? "");
    if (!sha) continue;
    await linkTasksFromText(`${message}\n${branch}`, workspaceId, {
      kind: GitLinkKind.COMMIT,
      externalKey: sha,
      title: message.split("\n")[0],
      url,
      metadata: { repo, branch } as Prisma.InputJsonValue,
    });
  }
}

async function handleCheckRun(body: Record<string, unknown>) {
  const check = body.check_run as Record<string, unknown> | undefined;
  const repo = (body.repository as Record<string, unknown>)?.full_name as string | undefined;
  const workspaceId = repo ? await workspaceIdForRepo(repo) : null;
  if (!check) return;
  const name = String(check.name ?? "check");
  const conclusion = String(check.conclusion ?? check.status ?? "");
  const prs = (check.pull_requests as Array<Record<string, unknown>>) ?? [];
  for (const pr of prs) {
    const title = String(pr.title ?? "");
    await linkTasksFromText(title, workspaceId, {
      kind: GitLinkKind.PULL_REQUEST,
      externalKey: `pr-${pr.number}`,
      title: `CI: ${name} → ${conclusion}`,
      metadata: { check: name, conclusion } as Prisma.InputJsonValue,
    });
  }
}

async function handleDeploymentStatus(body: Record<string, unknown>) {
  const deployment = body.deployment as Record<string, unknown> | undefined;
  const status = body.deployment_status as Record<string, unknown> | undefined;
  const repo = (body.repository as Record<string, unknown>)?.full_name as string | undefined;
  const workspaceId = repo ? await workspaceIdForRepo(repo) : null;
  if (!deployment || !status) return;
  const env = String(deployment.environment ?? "unknown");
  const state = String(status.state ?? "");
  const sha = String(deployment.sha ?? "");
  const text = [String(status.description ?? ""), sha].filter(Boolean).join("\n");
  await linkTasksFromText(text, workspaceId, {
    kind: GitLinkKind.DEPLOYMENT,
    externalKey: `${env}:${sha}`,
    title: `Deployment ${env}: ${state}`,
    metadata: { environment: env, state, sha } as Prisma.InputJsonValue,
  });

  await recordAudit({
    entityType: "github.deployment",
    entityId: sha,
    action: "deployment_status",
    source: AuditSource.GITHUB_WEBHOOK,
    newValue: { env, state },
  });
}
