import "server-only";

import { createHash } from "node:crypto";
import { MongoServerError } from "mongodb";
import { collections } from "./db";

export type StoredResponse = { status: number; body: unknown };

export type ClaimResult =
  | { kind: "claimed" }
  | { kind: "replay"; response: StoredResponse }
  | { kind: "mismatch" }
  | { kind: "in_progress" };

/** Order-independent fingerprint of a JSON body. */
export function hashBody(body: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
        : v;
  return createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
}

const WAIT_MS = 5_000;
const POLL_MS = 100;

/**
 * Claims the key before any work is done. The key is the document _id, so
 * only one request can claim it; concurrent duplicates wait for its response.
 */
export async function claimKey(key: string, requestHash: string): Promise<ClaimResult> {
  const { idempotency } = await collections();
  try {
    await idempotency.insertOne({ _id: key, request_hash: requestHash, state: "pending", created_at: new Date() });
    return { kind: "claimed" };
  } catch (err) {
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
  }

  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const existing = await idempotency.findOne({ _id: key });
    if (!existing) return claimKey(key, requestHash); // released by a failed attempt
    if (existing.request_hash !== requestHash) return { kind: "mismatch" };
    if (existing.state === "done" && existing.response) return { kind: "replay", response: existing.response };
    if (Date.now() > deadline) return { kind: "in_progress" };
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export async function saveResponse(key: string, response: StoredResponse) {
  const { idempotency } = await collections();
  await idempotency.updateOne({ _id: key }, { $set: { state: "done", response } });
}

/** Drops a pending key so a non-final outcome (429, 5xx) can be retried. */
export async function releaseKey(key: string) {
  const { idempotency } = await collections();
  await idempotency.deleteOne({ _id: key, state: "pending" });
}
