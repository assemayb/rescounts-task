import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/store/db.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, "../sql/schema.sql");

const eventId = process.env.SEED_EVENT_ID ?? "concert-1";
const eventName = process.env.SEED_EVENT_NAME ?? "Superstar Concert";
const capacity = Number(process.env.SEED_CAPACITY ?? 500);
const seatCount = Number(process.env.SEED_SEAT_COUNT ?? capacity);

async function main(): Promise<void> {
  validateSeedConfig();

  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);

  await pool.query("BEGIN");

  try {
    await pool.query("DELETE FROM events WHERE id = $1", [eventId]);

    await pool.query(
      `
        INSERT INTO events (id, name, capacity)
        VALUES ($1, $2, $3)
      `,
      [eventId, eventName, capacity],
    );

    await pool.query(
      `
        INSERT INTO seats (event_id, seat_id)
        SELECT $1, 'seat-' || seat_number
        FROM generate_series(1, $2) AS seat_number
      `,
      [eventId, seatCount],
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  console.log(
    `Seeded event ${eventId} with capacity ${capacity} and ${seatCount} seats.`,
  );
}

function validateSeedConfig(): void {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 500) {
    throw new Error("SEED_CAPACITY must be an integer between 0 and 500.");
  }

  if (!Number.isInteger(seatCount) || seatCount < 0) {
    throw new Error("SEED_SEAT_COUNT must be a non-negative integer.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
