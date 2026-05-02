import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["import", "module", "default"],
  },
  test: {
    include: ["packages/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov", "json-summary"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/icons.ts", "**/styles/**"],
      thresholds: {
        lines: 90,
        functions: 81,
        branches: 71,
        statements: 87,
      },
    },
  },
});
