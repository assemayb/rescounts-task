import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { pool } from "../src/store/db.js";
import { getEventSummary, migrate, resetEvent } from "../tests/dbHelper.js";

interface ScriptOptions {
  requests: number;
  capacity: number;
  seatCount: number;
  eventId: string;
  port: number;
}

const options = parseArgs(process.argv.slice(2));

await migrate(pool);
await resetEvent(pool, {
  eventId: options.eventId,
  capacity: options.capacity,
  seatCount: options.seatCount,
});

const app = createApp();
const server = createServer(app);

// start the server
await new Promise<void>((resolve) => {
  server.listen(options.port, resolve);
});

try {
  // send the requests
  const baseUrl = `http://127.0.0.1:${options.port}`;

  const responses = await Promise.all(
    Array.from({ length: options.requests }, async (_unused, index) => {
      const response = await fetch(
        `${baseUrl}/events/${options.eventId}/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `load-${index + 1}`,
          },
          body: JSON.stringify({
            userId: `user-${index + 1}`,
            seatId: `seat-${index + 1}`,
          }),
        },
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    }),
  );

  const successCount = responses.filter(
    (response) => response.status === 201,
  ).length;
  const conflictCount = responses.filter(
    (response) => response.status === 409,
  ).length;
  const unexpected = responses.filter(
    (response) => response.status !== 201 && response.status !== 409,
  );

  const summary = await getEventSummary(pool, options.eventId);

  assert.equal(
    successCount,
    options.capacity,
    `expected exactly ${options.capacity} successful purchases`,
  );
  assert.equal(
    conflictCount,
    options.requests - options.capacity,
    "expected every non-successful request to be rejected with 409",
  );
  assert.equal(unexpected.length, 0, "expected no unexpected response statuses");
  assert.equal(Number(summary.sold_count), options.capacity);
  assert.equal(Number(summary.sold_seats), options.capacity);
  assert.equal(Number(summary.duplicate_sold_seats), 0);

  console.log(
    `Passed: ${successCount} sold, ${conflictCount} rejected, 0 oversold.`,
  );
} finally {
  // finally close the server and the database connection
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
}

function parseArgs(args: string[]): ScriptOptions {
  const values = new Map<string, string>();

  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.+)$/);

    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const requests = Number(values.get("requests") ?? 200);
  const capacity = Number(values.get("capacity") ?? 10);
  const seatCount = Number(values.get("seats") ?? requests);
  const eventId = values.get("event") ?? "concert-load-test";
  const port = Number(values.get("port") ?? 3100);

  if (!Number.isInteger(requests) || requests <= 0) {
    throw new Error("--requests must be a positive integer");
  }

  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new Error("--capacity must be a non-negative integer");
  }

  if (!Number.isInteger(seatCount) || seatCount < requests) {
    throw new Error("--seats must be an integer greater than or equal to requests");
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("--port must be a positive integer");
  }

  if (capacity > requests) {
    throw new Error("--capacity must be less than or equal to --requests");
  }

  return {
    requests,
    capacity,
    seatCount,
    eventId,
    port,
  };
}
