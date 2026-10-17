import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests run against DATABASE_URL_TEST only — never the dev DB.
const testDb = process.env.DATABASE_URL_TEST;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      JWT_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
      APP_URL: "http://localhost:3000",
      BILLING_PROVIDER: "paymongo",
      PAYMONGO_SECRET_KEY: "sk_test_dummy",
      PAYMONGO_WEBHOOK_SECRET: "whsk_test_secret",
      PAYMONGO_MODE: "test",
      EMAIL_DRIVER: "console",
      ...(testDb ? { DATABASE_URL: testDb } : {}),
    },
  },
});
