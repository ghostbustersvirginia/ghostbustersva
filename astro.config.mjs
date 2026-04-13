// @ts-check
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";
import markdoc from "@astrojs/markdoc";
import vercel from "@astrojs/vercel";

import react from "@astrojs/react";

const productionSiteUrl = (process.env.SITE_URL || "https://gbva-site.vercel.app/").replace(
  /\/+$/,
  "",
);

// https://astro.build/config
export default defineConfig({
  output: "static",
  // Canonical and sitemap URLs always use the explicit primary domain.
  site: productionSiteUrl,
  env: {
    schema: {
      GOOGLE_MAPS_API_KEY: envField.string({ context: 'client', access: 'public' }),
      GOOGLE_SERVICE_KEY: envField.string({ context: 'server', access: 'public' }),
      GOOGLE_SERVICE_EMAIL: envField.string({ context: 'server', access: 'public' }),
    }
  },
  adapter: vercel(),
  integrations: [sitemap(), markdoc(), react()],
});