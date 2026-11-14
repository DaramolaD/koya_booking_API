"use client";

import Script from "next/script";

const VERSION = "5.17.14";
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${VERSION}`;

type SwaggerWindow = Window & {
  SwaggerUIBundle?: ((config: Record<string, unknown>) => unknown) & { presets: { apis: unknown } };
};

export function SwaggerUI() {
  return (
    <>
      <link rel="stylesheet" href={`${CDN}/swagger-ui.css`} precedence="default" />
      <div id="swagger-ui" />
      <Script
        src={`${CDN}/swagger-ui-bundle.js`}
        strategy="afterInteractive"
        onReady={() => {
          const ui = (window as SwaggerWindow).SwaggerUIBundle;
          ui?.({
            url: "/openapi.json",
            dom_id: "#swagger-ui",
            presets: [ui.presets.apis],
            deepLinking: true,
            tryItOutEnabled: false,
          });
        }}
      />
    </>
  );
}
