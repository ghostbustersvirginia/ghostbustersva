// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import markdoc from "@astrojs/markdoc";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import vercel from "@astrojs/vercel";

const deploymentSite = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://ghostbustersva.vercel.app";

// https://astro.build/config
export default defineConfig({
  // Pages are pre-rendered (static) by default.
  // Keystatic opts its API/admin routes into server rendering via the integration.
  output: "static",
  // Use the deployment URL on Vercel previews; default to production URL locally.
  site: deploymentSite,
  adapter: vercel(),
  integrations: [sitemap(), markdoc(), react(), keystatic()],
  security: {
    // Trust forwarded host headers from these domains so Keystatic's
    // OAuth callback URLs resolve correctly on Vercel (not to localhost).
    allowedDomains: [
      { hostname: "ghostbustersva.vercel.app", protocol: "https" },
      { hostname: "ghostbustersva.com", protocol: "https" },
      {
        hostname: "ghostbustersva-git-**-afton-gauntletts-projects.vercel.app",
        protocol: "https",
      },
    ],
  },
});
