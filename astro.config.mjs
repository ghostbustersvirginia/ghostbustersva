// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import markdoc from "@astrojs/markdoc";
import keystatic from "@keystatic/astro";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  // Pages are pre-rendered (static) by default.
  // Keystatic opts its API/admin routes into server rendering via the integration.
  output: "static",
  // Update to ghostbustersva.com when custom domain is connected.
  site: "https://ghostbustersva.vercel.app",
  adapter: vercel(),
  integrations: [react(), sitemap(), markdoc(), keystatic()],
  security: {
    // Trust forwarded host headers from these domains so Keystatic's
    // OAuth callback URLs resolve correctly on Vercel (not to localhost).
    allowedDomains: [
      { hostname: "ghostbustersva.vercel.app", protocol: "https" },
      { hostname: "ghostbustersva.com", protocol: "https" },
    ],
  },
});
