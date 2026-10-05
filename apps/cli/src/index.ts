#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();
program.name("traceforge").description("TraceForge CLI").version("0.1.0");

const apiUrl = process.env.TRACEFORGE_API_URL ?? "http://localhost:4000";
const token = process.env.TRACEFORGE_API_TOKEN;

async function api(path: string) {
  if (!token) throw new Error("TRACEFORGE_API_TOKEN required");
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text;
}

const task = program.command("task").description("Task commands");

task
  .command("get <id>")
  .description("Get task by id or TF-123")
  .action(async (id: string) => {
    console.log(await api(`/api/v1/tasks/${encodeURIComponent(id)}`));
  });

task
  .command("context <id>")
  .description("Print AI context JSON")
  .action(async (id: string) => {
    console.log(await api(`/api/v1/tasks/${encodeURIComponent(id)}/ai-context`));
  });

program.parse();
