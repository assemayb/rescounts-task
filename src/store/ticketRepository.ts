import type { ApiResponse } from "../http.js";
import type { DbClient } from "./db.js";

export interface PurchaseInput {
  eventId: string;
  userId: string;
  seatId: string;
  idempotencyKey: string;
}

export interface EventState {
  soldCount: number;
  capacity: number;
}

export interface Seat {
  status: "available" | "sold";
}

export interface IdempotencyRecord {
  requestHash: string;
  status: "processing" | "completed";
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
}

export interface TicketRepository {
  insertIdempotencyKey(
    client: DbClient,
    input: PurchaseInput,
    requestHash: string,
  ): Promise<boolean>;
  findIdempotencyKeyForUpdate(
    client: DbClient,
    input: PurchaseInput,
  ): Promise<IdempotencyRecord | null>;
  saveIdempotencyResponse(
    client: DbClient,
    input: PurchaseInput,
    response: ApiResponse,
  ): Promise<void>;
  findSeatForUpdate(
    client: DbClient,
    input: Pick<PurchaseInput, "eventId" | "seatId">,
  ): Promise<Seat | null>;
  incrementSoldCount(
    client: DbClient,
    eventId: string,
  ): Promise<EventState | null>;
  sellSeat(client: DbClient, input: PurchaseInput): Promise<void>;
}

export function createTicketRepository(): TicketRepository {
  return {
    insertIdempotencyKey,
    findIdempotencyKeyForUpdate,
    saveIdempotencyResponse,
    findSeatForUpdate,
    incrementSoldCount,
    sellSeat,
  };
}

interface IdempotencyRow {
  request_hash: string;
  status: "processing" | "completed";
  response_status: number | null;
  response_body: Record<string, unknown> | null;
}

interface EventUpdateRow {
  sold_count: number;
  capacity: number;
}

async function insertIdempotencyKey(
  client: DbClient,
  input: PurchaseInput,
  requestHash: string,
): Promise<boolean> {
  const result = await client.query<{ key: string }>(
    `
      INSERT INTO idempotency_keys (event_id, key, request_hash, status)
      SELECT $1, $2, $3, 'processing'
      WHERE EXISTS (SELECT 1 FROM events WHERE id = $1)
      ON CONFLICT (event_id, key) DO NOTHING
      RETURNING key
    `,
    [input.eventId, input.idempotencyKey, requestHash],
  );

  return result.rowCount === 1;
}

async function findIdempotencyKeyForUpdate(
  client: DbClient,
  input: PurchaseInput,
): Promise<IdempotencyRecord | null> {
  const result = await client.query<IdempotencyRow>(
    `
      SELECT request_hash, status, response_status, response_body
      FROM idempotency_keys
      WHERE event_id = $1 AND key = $2
      FOR UPDATE
    `,
    [input.eventId, input.idempotencyKey],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    requestHash: row.request_hash,
    status: row.status,
    responseStatus: row.response_status,
    responseBody: row.response_body,
  };
}

async function saveIdempotencyResponse(
  client: DbClient,
  input: PurchaseInput,
  response: ApiResponse,
): Promise<void> {
  await client.query(
    `
      UPDATE idempotency_keys
      SET status = 'completed',
          response_status = $3,
          response_body = $4,
          updated_at = now()
      WHERE event_id = $1 AND key = $2
    `,
    [input.eventId, input.idempotencyKey, response.status, response.body],
  );
}

async function findSeatForUpdate(
  client: DbClient,
  input: Pick<PurchaseInput, "eventId" | "seatId">,
): Promise<Seat | null> {
  const result = await client.query<Seat>(
    `
      SELECT status
      FROM seats
      WHERE event_id = $1 AND seat_id = $2
      FOR UPDATE
    `,
    [input.eventId, input.seatId],
  );

  return result.rows[0] ?? null;
}

async function incrementSoldCount(
  client: DbClient,
  eventId: string,
): Promise<EventState | null> {
  const result = await client.query<EventUpdateRow>(
    `
      UPDATE events
      SET sold_count = sold_count + 1
      WHERE id = $1 AND sold_count < capacity
      RETURNING sold_count, capacity
    `,
    [eventId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    soldCount: row.sold_count,
    capacity: row.capacity,
  };
}

async function sellSeat(client: DbClient, input: PurchaseInput): Promise<void> {
  await client.query(
    `
      UPDATE seats
      SET status = 'sold',
          sold_to_user_id = $3,
          sold_at = now()
      WHERE event_id = $1 AND seat_id = $2
    `,
    [input.eventId, input.seatId, input.userId],
  );
}
