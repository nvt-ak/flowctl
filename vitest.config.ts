import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    pool: "forks",
    fileParallelism: false,
    testTimeout: 120_000,
    include: [
      "test/unit/**/*.test.ts",
      "test/integration/**/*.test.ts",
      "test/e2e/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Phase 7 migration-plan target (enforce once aggregate lines ≥ 85%):
      // thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 },
      watermarks: {
        statements: [85, 95],
        branches: [80, 95],
        functions: [85, 95],
        lines: [85, 95],
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/index.ts",
        "src/monitor/**", // deferred Python (Phase 5)
      ],
    },
  },
});
