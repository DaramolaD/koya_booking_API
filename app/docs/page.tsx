import type { Metadata } from "next";
import { SITE } from "@/lib/site-config";
import { SwaggerUI } from "./swagger-ui";

export const metadata: Metadata = {
  title: `API docs · ${SITE.name}`,
  description: "Interactive documentation for the clinic booking API.",
};

export default function DocsPage() {
  return (
    <main className="min-h-svh bg-white">
      <SwaggerUI />
    </main>
  );
}
