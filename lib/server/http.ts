import "server-only";

import { unstable_rethrow } from "next/navigation";
import { checkApiKey } from "./auth";

export function json<T>(body: T, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers });
}

export function apiError(status: number, message: string, headers?: Record<string, string>) {
  return Response.json({ error: message }, { status, headers });
}

/** Wraps every API route: API key check, then JSON 500s for unexpected errors. */
export function handle<Args extends [Request, ...unknown[]]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const auth = checkApiKey(args[0]);
    if (auth === "misconfigured") {
      console.error("[api] API_KEY is not set: refusing all requests");
      return apiError(500, "server misconfigured");
    }
    if (auth === "unauthorized") return apiError(401, "missing or invalid API key");

    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err); // let Next.js control-flow errors propagate
      console.error("[api] unhandled error", err);
      return apiError(500, "internal error");
    }
  };
}

export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
