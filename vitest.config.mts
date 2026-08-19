import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dir, "src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/*.contract.test.ts"],
          setupFiles: ["src/test/setup-storage.ts"],
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/test/setup-component.ts"],
        },
      },
    ],
  },
});
