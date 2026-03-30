// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import markdoc from "@astrojs/markdoc";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import vercel from "@astrojs/vercel";

const domains = [
  { hostname: "ghostbustersva.vercel.app", protocol: "https" },
  { hostname: "ghostbustersva.com", protocol: "https" },
  { hostname: "gbva-web.jonathancook.site", protocol: "https" }
];
const hosts = domains.map(d => d.hostname);

// https://astro.build/config
export default defineConfig({
  // Pages are pre-rendered (static) by default.
  // Keystatic opts its API/admin routes into server rendering via the integration.
  output: "static",
  // Update to ghostbustersva.com when custom domain is connected.
  site: "https://ghostbustersva.vercel.app",
  adapter: vercel(),
  integrations: [sitemap(), markdoc(), react(), keystatic()],
  security: {
    // Trust forwarded host headers from these domains so Keystatic's
    // OAuth callback URLs resolve correctly on Vercel (not to localhost).
    allowedDomains: domains,
  },
  vite: {
    server: {
      allowedHosts: hosts,
    }
  },
});
