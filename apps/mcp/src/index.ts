#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TraceForgeApiClient } from "./api-client.js";

const baseUrl = process.env.TRACEFORGE_API_URL ?? "http://localhost:4000";
const token = process.env.TRACEFORGE_API_TOKEN;
if (!token) {
  console.error("TRACEFORGE_API_TOKEN is required");
  process.exit(1);
}

const client = new TraceForgeApiClient(baseUrl, token);

const server = new McpServer({
  name: "traceforge",
  version: "0.1.0",
});

server.tool(
  "search_tasks",
  "Search tasks by text across accessible workspaces",
  { q: z.string().min(2), workspaceSlug: z.string().optional() },
  async ({ q, workspaceSlug }) => {
    const data = await client.searchTasks(q, workspaceSlug);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_task",
  "Get a task by ID or identifier (e.g. TF-123)",
  { taskId: z.string() },
  async ({ taskId }) => {
    const data = await client.getTask(taskId);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_ai_context",
  "Retrieve structured AI context for a task including git and external refs",
  { taskId: z.string() },
  async ({ taskId }) => {
    const data = await client.getAiContext(taskId);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_task",
  "Create a task in a project",
  {
    projectId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  },
  async (args) => {
    const data = await client.createTask(args.projectId, args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_task",
  "Update task fields",
  {
    taskId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    statusId: z.string().optional(),
    version: z.number().optional(),
  },
  async ({ taskId, ...body }) => {
    const data = await client.updateTask(taskId, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "transition_task",
  "Transition task to another workflow state",
  {
    taskId: z.string(),
    toStatusId: z.string(),
    version: z.number().optional(),
  },
  async ({ taskId, toStatusId, version }) => {
    const data = await client.transitionTask(taskId, toStatusId, version);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "add_comment",
  "Add a markdown comment to a task",
  { taskId: z.string(), body: z.string() },
  async ({ taskId, body }) => {
    const data = await client.addComment(taskId, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "link_notion_page",
  "Link a Notion page reference to a task",
  {
    taskId: z.string(),
    externalId: z.string(),
    title: z.string().optional(),
    url: z.string().url().optional(),
  },
  async ({ taskId, externalId, title, url }) => {
    const data = await client.linkExternal(taskId, {
      provider: "NOTION",
      externalId,
      title,
      url,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "link_linear_issue",
  "Link a Linear issue reference to a task",
  {
    taskId: z.string(),
    externalId: z.string(),
    externalKey: z.string().optional(),
    title: z.string().optional(),
    url: z.string().url().optional(),
  },
  async ({ taskId, externalId, externalKey, title, url }) => {
    const data = await client.linkExternal(taskId, {
      provider: "LINEAR",
      externalId,
      externalKey,
      title,
      url,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "attach_url",
  "Attach a URL to a task (auto-classified when possible)",
  { taskId: z.string(), url: z.string().url(), title: z.string().optional() },
  async ({ taskId, url, title }) => {
    const data = await client.attachUrl(taskId, url, title);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_task_git_history",
  "Get git links and history summary for a task (from AI context git section)",
  { taskId: z.string() },
  async ({ taskId }) => {
    const ctx = (await client.getAiContext(taskId)) as { git?: unknown };
    return { content: [{ type: "text", text: JSON.stringify(ctx.git ?? {}, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
