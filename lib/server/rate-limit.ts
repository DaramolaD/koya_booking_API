import "server-only";

import { MongoServerError } from "mongodb";
import { collections } from "./db";

export const RATE_LIMIT = 5;
export const WINDOW_MS = 60_000;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding-window limit per email, stored in MongoDB so it holds across
 * serverless instances. Evaluated in a single atomic update to stay correct
 * under concurrent requests. Rejected attempts are not recorded.
 */
export async function hitRateLimit(email: string, now = new Date()): Promise<RateLimitResult> {
  const { rateLimits } = await collections();
  const cutoff = new Date(now.getTime() - WINDOW_MS);

  const update = [
    { $set: { hits: { $filter: { input: { $ifNull: ["$hits", []] }, cond: { $gt: ["$$this", cutoff] } } } } },
    { $set: { allowed: { $lt: [{ $size: "$hits" }, RATE_LIMIT] } } },
    {
      $set: {
        hits: { $cond: ["$allowed", { $concatArrays: ["$hits", [now]] }, "$hits"] },
        expires_at: new Date(now.getTime() + WINDOW_MS),
      },
    },
  ];

  let doc;
  for (let attempt = 0; ; attempt++) {
    try {
      doc = await rateLimits.findOneAndUpdate({ _id: email }, update, { upsert: true, returnDocument: "after" });
      break;
    } catch (err) {
      // Concurrent first upserts for the same email: retry as an update.
      if (err instanceof MongoServerError && err.code === 11000 && attempt < 3) continue;
      throw err;
    }
  }

  const result = doc as unknown as { allowed: boolean; hits: Date[] } | null;
  if (!result || result.allowed) return { allowed: true };

  const oldest = Math.min(...result.hits.map((h) => new Date(h).getTime()));
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now.getTime()) / 1000));
  return { allowed: false, retryAfterSeconds };
}
