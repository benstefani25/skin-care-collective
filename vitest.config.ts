import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

// Integration tests run against the configured Supabase project. Load the same
// env the app uses so the service-role + anon clients are available.
loadEnv({ path: [".env.local", ".env"] });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
