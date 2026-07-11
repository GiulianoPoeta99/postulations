import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    fileParallelism: false,
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/components/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.ts",
        "app/actions.ts",
        "app/api/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "tests/**",
        "app/globals.css",
        "app/layout.tsx",
        "app/page.tsx",
        "next.config.mjs",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 80,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
