import "server-only";

import { z } from "zod";

const required = (field: string) => ({ error: `${field} is required` });
const LIMIT_MESSAGE = "limit must be an integer from 1 to 50";

export const NewBookingSchema = z.object({
  slot_id: z.string(required("slot_id")).trim().min(1, "slot_id is required"),
  name: z.string(required("name")).trim().min(1, "name is required").max(200, "name is too long"),
  email: z
    .string(required("email"))
    .trim()
    .min(1, "email is required")
    .max(254, "email is too long")
    .toLowerCase()
    .pipe(z.email({ error: "email is invalid" })),
});
export type NewBookingInput = z.infer<typeof NewBookingSchema>;

export const ListBookingsQuerySchema = z.object({
  email: z.string(required("email")).trim().min(1, "email is required").toLowerCase(),
  limit: z
    .string()
    .regex(/^\d+$/, LIMIT_MESSAGE)
    .transform(Number)
    .pipe(z.number().int().min(1, LIMIT_MESSAGE).max(50, LIMIT_MESSAGE))
    .default(10),
  cursor: z.string().min(1, "cursor is invalid").optional(),
});

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "invalid request";
}
