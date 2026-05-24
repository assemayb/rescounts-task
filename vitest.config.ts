import { defineConfig } from "vitest/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rescounts:rescounts@localhost:5432/rescounts";

const testDB = new URL(databaseUrl);
testDB.pathname = "/rescounts_test";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testDB.toString(),
    },
  },
});
