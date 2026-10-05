import type { FastifyPluginAsync } from "fastify";
import { handleGithubWebhook, verifyGithubSignature } from "../services/github-webhook.js";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
  });

  app.post("/webhooks/github", async (req, reply) => {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const event = req.headers["x-github-event"] as string | undefined;
    const raw = req.body as string;

    if (!verifyGithubSignature(raw, signature)) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (event) {
      await handleGithubWebhook(event, payload);
    }
    return { ok: true };
  });
};
