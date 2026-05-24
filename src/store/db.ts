import pg from "pg";
import { config } from "../config.js";

export type DbClient = pg.PoolClient;

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 20),
});


export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
