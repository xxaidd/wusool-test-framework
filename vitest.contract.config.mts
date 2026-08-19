import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Gated consumer-driven contract tests against the approved Wusool test
 * backend. NOT run by `bun run test` — only via `bun run test:contract`.
 * Credentials come from the environment (`WUSOOL_CONTRACT_*`, plus `.env` via
 * `test.env`); never from files or commits.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(dir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/infrastructure/contracts/**/*.contract.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
