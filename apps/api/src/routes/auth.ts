import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@traceforge/db";
import { loginSchema, registerSchema } from "@traceforge/shared";
import { signAccessToken } from "../lib/auth.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
      },
    });
    const token = await signAccessToken({ id: user.id, email: user.email, name: user.name });
    return { user: { id: user.id, email: user.email, name: user.name }, accessToken: token };
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.passwordHash) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "Invalid credentials" });
    const token = await signAccessToken({ id: user.id, email: user.email, name: user.name });
    return { user: { id: user.id, email: user.email, name: user.name }, accessToken: token };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await app.requireUser(req);
    return { user };
  });
};
