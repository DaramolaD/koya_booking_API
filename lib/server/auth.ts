import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Constant-time comparison; hashing gives both sides equal length.
function safeEqual(a: string, b: string) {
  return timingSafeEqual(sha256(a), sha256(b));
}

export type AuthResult = "ok" | "unauthorized" | "misconfigured";

export function checkApiKey(req: Request): AuthResult {
  const expected = process.env.API_KEY;
  if (!expected) return "misconfigured";
  const given = req.headers.get("x-api-key");
  return given !== null && safeEqual(given, expected) ? "ok" : "unauthorized";
}
