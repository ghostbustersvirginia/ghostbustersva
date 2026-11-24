/**
 * Module hooks so standalone scripts can import the site's server code:
 *  - `astro:env/server` resolves to a shim whose getSecret reads process.env
 *    (scripts load .env.local with --env-file);
 *  - extensionless relative imports from .ts files resolve to `.ts`, `.tsx`,
 *    or `/index.ts`, as Vite does.
 *
 * Use with: node --experimental-transform-types --import ./scripts/lib/register.mjs <script>.ts
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const ASTRO_ENV_SHIM =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getSecret = (name) => process.env[name];" +
      "export const getEnv = (name) => process.env[name];",
  );

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "astro:env/server") return { url: ASTRO_ENV_SHIM, shortCircuit: true };

    const parent = context.parentURL ?? "";
    const fromTs = parent.endsWith(".ts") || parent.endsWith(".tsx");
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (fromTs && relative && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        const url = new URL(specifier + suffix, parent);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
