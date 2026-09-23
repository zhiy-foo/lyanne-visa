import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**", "**/*.e2e.ts", "**/*.spec.ts"],
  },
});
