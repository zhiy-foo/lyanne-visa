import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**", "**/*.e2e.ts", "**/*.spec.ts"],
    // Each test/db/*.test.ts file boots its own PGlite (an in-process
    // Postgres) per test via createTestDb(). Running the full suite (src/
    // and test/db/ together) lets vitest schedule many of those files'
    // hooks in parallel, which starves the machine enough that
    // test/db/visibility.test.ts's beforeEach can miss the default 10s hook
    // timeout and then hit "PGlite is closed" when a later hook in the same
    // (now-torn-down) run tries to use it — reproducible with `npx vitest
    // run` but not with `test/db` or `src` run alone. Limiting how many
    // test files run concurrently removes the contention; the timeout bump
    // is extra headroom for the (still real, just no longer pathological)
    // cost of a PGlite boot per db test file under load.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
