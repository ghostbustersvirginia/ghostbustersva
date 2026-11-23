// @ts-check
import eslintPluginAstro from "eslint-plugin-astro";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Astro recommended rules (includes TS support)
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      // Keep strict but practical — loosen rules here as needed
    },
  },
  {
    ignores: ["dist/", ".astro/", "node_modules/", ".vercel/"],
  },
];
