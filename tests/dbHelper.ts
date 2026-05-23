import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, "../sql/schema.sql");

interface ResetEventOptions {
  eventId: string;
  capacity: number;
  seatCount: number;
  name?: string;
}

interface EventSummary {
  capacity: number;
  sold_count: number;
  sold_seats: string;
  duplicate_sold_seats: string;
}

export async function migrate(pool: Pool): Promise<void> {
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
}

export async function resetEvent(
  pool: Pool,
  options: ResetEventOptions,
): Promise<void> {
  await pool.query("BEGIN");

  try {
    await pool.query("DELETE FROM events WHERE id = $1", [options.eventId]);
    await pool.query(
      `
        INSERT INTO events (id, name, capacity, sold_count)
        VALUES ($1, $2, $3, 0)
      `,
      [options.eventId, options.name ?? "Test Concert", options.capacity],
    );

    await pool.query(
      `
        INSERT INTO seats (event_id, seat_id)
        SELECT $1, 'seat-' || seat_number
        FROM generate_series(1, $2) AS seat_number
      `,
      [options.eventId, options.seatCount],
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function getEventSummary(
  pool: Pool,
  eventId: string,
): Promise<EventSummary> {
  const result = await pool.query<EventSummary>(
    `
      SELECT
        e.capacity,
        e.sold_count,
        COUNT(s.seat_id) FILTER (WHERE s.status = 'sold') AS sold_seats,
        (
          COUNT(s.seat_id) FILTER (WHERE s.status = 'sold')
          - COUNT(DISTINCT s.seat_id) FILTER (WHERE s.status = 'sold')
        ) AS duplicate_sold_seats
      FROM events e
      LEFT JOIN seats s ON s.event_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `,
    [eventId],
  );

  const summary = result.rows[0];

  if (!summary) {
    throw new Error(`Event ${eventId} was not found.`);
  }

  return summary;
}
