// Minimal dashboard authentication: one shared team password (from the environment)
// exchanged for a signed, expiring, HttpOnly cookie. No user accounts, no server-side
// session store — appropriate for a small project team.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const ADMIN_COOKIE = "hlac_admin";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time password comparison (hashing first equalises lengths). */
export function passwordMatches(candidate: string, expected: string): boolean {
  return timingSafeEqual(sha256(candidate), sha256(expected));
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueToken(secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: unknown };
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

export function cookieOptions(production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "strict" as const,
    path: "/api/admin",
    maxAge: TTL_MS,
  };
}

export function requireAdmin(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (verifyToken(req.cookies?.[ADMIN_COOKIE], secret)) return next();
    res.status(401).json({ error: "unauthorized", message: "Sign in to the team dashboard first." });
  };
}
