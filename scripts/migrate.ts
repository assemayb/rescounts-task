import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/store/db.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, "../sql/schema.sql");

async function main(): Promise<void> {
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
  console.log("database migration complete");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
