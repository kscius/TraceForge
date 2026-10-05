import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  request_id: string;
  errors?: Array<{ pointer?: string; code: string; detail: string }>;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function sendProblem(
  reply: FastifyReply,
  opts: {
    status: number;
    code: string;
    title: string;
    detail?: string;
    instance?: string;
    errors?: ProblemBody["errors"];
  },
  request?: FastifyRequest,
): FastifyReply {
  const requestId = request?.id ? String(request.id) : `req_${randomUUID()}`;
  const body: ProblemBody = {
    type: `https://traceforge.dev/problems/${opts.code.replace(/_/g, "-")}`,
    title: opts.title,
    status: opts.status,
    code: opts.code,
    detail: opts.detail ?? opts.title,
    instance: opts.instance,
    request_id: requestId,
    errors: opts.errors,
  };
  return reply.status(opts.status).type("application/problem+json").send(body);
}
