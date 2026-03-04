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
  site: "https://ghostbustersva.com",
  adapter: vercel(),
  integrations: [react(), sitemap(), markdoc(), keystatic()],
});
