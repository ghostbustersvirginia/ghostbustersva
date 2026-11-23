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

const isBuild = process.argv.includes("build");
const SANITIZE_HTML_BUNDLE = [
  "sanitize-html",
  "htmlparser2",
  "domhandler",
  "domutils",
  "domelementtype",
  "dom-serializer",
  "entities",
  "escape-string-regexp",
  "is-plain-object",
  "launder",
  "parse-srcset",
];

// https://astro.build/config
export default defineConfig({
  output: "static",
  // Canonical and sitemap URLs always use the explicit primary domain.
  site: productionSiteUrl,
  env: {
    schema: {
      GOOGLE_MAPS_API_KEY: envField.string({ context: "client", access: "public", optional: true }),
      // Member calendar maps (PRD 009): browser key restricted to the site's referrers.
      PUBLIC_GOOGLE_MAPS_BROWSER_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_GOOGLE_MAPS_MAP_ID: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      GOOGLE_GEOCODING_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      RESEND_API_KEY: envField.string({ context: "server", access: "secret" }),
      CONTACT_FROM_EMAIL: envField.string({ context: "server", access: "secret" }),
      CONTACT_TO_EMAIL: envField.string({ context: "server", access: "secret" }),
      UPSTASH_REDIS_REST_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      UPSTASH_REDIS_REST_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Vercel Marketplace Upstash names (used when UPSTASH_REDIS_REST_* are absent).
      KV_REST_API_URL: envField.string({ context: "server", access: "secret", optional: true }),
      KV_REST_API_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      // Member calendar (PRD 008). Optional so the static build works without them.
      GOOGLE_OAUTH_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GBVA_EVENTS_CALENDAR_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GBVA_MEMBERS_GROUP: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GBVA_ORGANIZERS_GROUP: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_ACCESS_MODE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_DELEGATED_USER: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GOOGLE_SERVICE_ACCOUNT_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GCP_PROJECT_NUMBER: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GCP_SERVICE_ACCOUNT_EMAIL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GCP_WORKLOAD_IDENTITY_POOL_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      SESSION_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      CALENDAR_WEBHOOK_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      CRON_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MEMBERSHIP_TTL_MINUTES: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      LATE_CHANGE_WINDOW_MINUTES: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      LATE_CHANGE_RETENTION_DAYS: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  adapter: vercel(),
  vite: {
    ssr: {
      // sanitize-html is CommonJS but require()s the ESM-only htmlparser2.
      // Vercel's function loader can't require() ESM, so the production build
      // bundles them (with their dependency tree) instead of loading them from
      // node_modules. Only for builds: the dev server doesn't convert bundled
      // CommonJS, and Node loads them fine in dev.
      noExternal: isBuild ? SANITIZE_HTML_BUNDLE : [],
    },
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes("/members/calendar") }),
    markdoc(),
    react(),
  ],
});
