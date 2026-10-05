import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(1).max(120).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  contentMarkdown: z.string().max(200000).optional(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  typeId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  position: z.number().int().min(0).optional(),
  version: z.number().int().min(1).optional(),
});

export const transitionTaskSchema = z.object({
  toStatusId: z.string().cuid(),
  version: z.number().int().min(1).optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const linkTasksSchema = z.object({
  toTaskId: z.string().cuid(),
  relationType: z.enum([
    "BLOCKS",
    "BLOCKED_BY",
    "RELATES_TO",
    "DUPLICATES",
    "DEPENDS_ON",
    "FIXES",
    "REGRESSION_OF",
  ]),
});

export const attachUrlSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500).optional(),
});
