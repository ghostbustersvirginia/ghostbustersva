import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Astro virtual module used by server code; see tests/shims.
      "astro:env/server": fileURLToPath(
        new URL("./tests/shims/astro-env-server.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Include .ts test files
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
