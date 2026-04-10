// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import markdoc from "@astrojs/markdoc";
import vercel from "@astrojs/vercel";

const deploymentSite = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://ghostbustersva.vercel.app";

// https://astro.build/config
export default defineConfig({
  output: "static",
  // Use the deployment URL on Vercel previews; default to production URL locally.
  site: deploymentSite,
  adapter: vercel(),
  integrations: [sitemap(), markdoc()],
});
