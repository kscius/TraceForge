import type { FastifyRequest } from "fastify";
import * as jose from "jose";
import { prisma } from "@traceforge/db";
import { config } from "../config.js";
import { sha256 } from "./crypto.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  authMethod?: "jwt" | "pat";
  tokenScopes?: string[];
};

const accessKey = new TextEncoder().encode(config.jwtAccessSecret);

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new jose.SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, accessKey);
    const sub = payload.sub;
    if (!sub) return null;
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      authMethod: "jwt",
    };
  } catch {
    return null;
  }
}

export async function resolveRequestUser(req: FastifyRequest): Promise<AuthUser | null> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const bearer = auth.slice(7);
    const fromJwt = await verifyAccessToken(bearer);
    if (fromJwt) return fromJwt;

    const tokenHash = sha256(bearer);
    const apiToken = await prisma.apiToken.findFirst({
      where: {
        tokenHash,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: true },
    });
    if (apiToken) {
      await prisma.apiToken.update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() },
      });
      return {
        id: apiToken.user.id,
        email: apiToken.user.email,
        name: apiToken.user.name,
        authMethod: "pat",
        tokenScopes: apiToken.scopes,
      };
    }
  }
  return null;
}
