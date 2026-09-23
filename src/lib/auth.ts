import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Shared-access-code gate: one internal password protects every mutating
// action and PII-bearing read, not per-user accounts. This is a deliberate
// stopgap -- proper per-person UNDP login (Azure AD) is the better long-term
// answer, but needs a tenant-admin-approved app registration, which was
// blocking closing this hole today. See project memory for the tradeoff.

export const SESSION_COOKIE = "aar_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionSecret(): string {
  // Falls back to ACCESS_CODE so a single env var is enough to get running;
  // set SESSION_SECRET separately in production so rotating the login code
  // doesn't also invalidate every signed cookie format assumption.
  const secret = process.env.SESSION_SECRET || process.env.ACCESS_CODE;
  if (!secret) {
    throw new Error("ACCESS_CODE (or SESSION_SECRET) must be set to use auth.");
  }
  return secret;
}

function sign(value: string): string {
  const sig = createHmac("sha256", getSessionSecret()).update(value).digest("hex");
  return `${value}.${sig}`;
}

function verify(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const value = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = createHmac("sha256", getSessionSecret()).update(value).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }
  const expiresAt = Number(value.split(":")[1]);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function createSessionToken(): { token: string; maxAgeSeconds: number } {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return {
    token: sign(`session:${expiresAt}`),
    maxAgeSeconds: Math.floor(SESSION_DURATION_MS / 1000),
  };
}

export function isValidAccessCode(code: string): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected || !code) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(expected);
  // Compare against a fixed-length buffer first so length itself doesn't
  // leak via timing before reaching the constant-time comparison.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return verify(token);
}

// Every mutating (and PII-bearing) API route calls this at the top and
// bails with a 401 if it's false -- explicitly, not just relying on the
// page-level redirect in proxy.ts. A matcher gap or route move could
// silently remove proxy coverage; this can't be bypassed that way.
export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
