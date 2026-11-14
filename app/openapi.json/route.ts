import type { NextRequest } from "next/server";
import spec from "@/docs/openapi.json";

// Public: serves the spec for /docs, with this deployment's API as the server.
export function GET(req: NextRequest) {
  return Response.json({ ...spec, servers: [{ url: `${req.nextUrl.origin}/api` }] });
}
