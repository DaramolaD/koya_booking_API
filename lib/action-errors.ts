import type { ApiFailure } from "./api-client";

export type ActionError = {
  ok: false;
  code: string;
  message: string;
  retryAfterSeconds?: number;
};

export type ActionResult<T, Extra = object> = ({ ok: true; data: T } & Extra) | ActionError;

const FRIENDLY: Record<string, string> = {
  RATE_LIMITED: "Too many attempts. Please wait a moment.",
  NETWORK_ERROR: "We couldn't reach the booking service. Please try again.",
  SERVER_ERROR: "Something went wrong on our side. Please try again.",
  UNAUTHORIZED: "The booking service rejected our credentials. Please contact the clinic.",
  CONFIG_ERROR: "The booking service isn't configured. Please contact the clinic.",
};

export function toActionError(f: ApiFailure, overrides: Partial<Record<string, string>> = {}): ActionError {
  return {
    ok: false,
    code: f.code,
    message: overrides[f.code] ?? FRIENDLY[f.code] ?? f.message,
    retryAfterSeconds: f.retryAfterSeconds,
  };
}
