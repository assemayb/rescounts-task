import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/store/db.js";
import { hashPurchaseRequest } from "../src/utils/hash.js";
import { getEventSummary, migrate, resetEvent } from "./dbHelper.js";

const app = createApp();

describe("POST /events/:id/purchase", () => {
  beforeAll(async () => {
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("validates idempotency key and request body", async () => {
    const missingKey = await request(app)
      .post("/events/test-validation/purchase")
      .send({ userId: "user-1", seatId: "seat-1" });

    const invalidBody = await request(app)
      .post("/events/test-validation/purchase")
      .set("Idempotency-Key", "invalid-body")
      .send({ userId: "", seatId: "seat-1" });

    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe("missing_idempotency_key");
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body.error.code).toBe("invalid_request");
  });

  it("sells an available seat", async () => {
    await resetEvent(pool, {
      eventId: "test-single",
      capacity: 1,
      seatCount: 1,
    });

    const response = await request(app)
      .post("/events/test-single/purchase")
      .set("Idempotency-Key", "single-1")
      .send({ userId: "user-1", seatId: "seat-1" });

    expect(response.status).toBe(201);
    expect(response.body.purchase).toMatchObject({
      eventId: "test-single",
      userId: "user-1",
      seatId: "seat-1",
      status: "sold",
    });

    const summary = await getEventSummary(pool, "test-single");
    expect(Number(summary.sold_count)).toBe(1);
    expect(Number(summary.sold_seats)).toBe(1);
  });

  it("returns the stored response for an idempotent retry", async () => {
    await resetEvent(pool, {
      eventId: "test-idempotent",
      capacity: 1,
      seatCount: 1,
    });

    const first = await request(app)
      .post("/events/test-idempotent/purchase")
      .set("Idempotency-Key", "retry-1")
      .send({ userId: "user-1", seatId: "seat-1" });

    const second = await request(app)
      .post("/events/test-idempotent/purchase")
      .set("Idempotency-Key", "retry-1")
      .send({ userId: "user-1", seatId: "seat-1" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    const summary = await getEventSummary(pool, "test-idempotent");
    expect(Number(summary.sold_count)).toBe(1);
    expect(Number(summary.sold_seats)).toBe(1);
  });

  it("rejects an idempotency key reused with a different request", async () => {
    await resetEvent(pool, {
      eventId: "test-key-reuse",
      capacity: 2,
      seatCount: 2,
    });

    await request(app)
      .post("/events/test-key-reuse/purchase")
      .set("Idempotency-Key", "same-key")
      .send({ userId: "user-1", seatId: "seat-1" })
      .expect(201);

    const response = await request(app)
      .post("/events/test-key-reuse/purchase")
      .set("Idempotency-Key", "same-key")
      .send({ userId: "user-2", seatId: "seat-2" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("idempotency_key_reused");
  });

  it("returns 404 when the event does not exist", async () => {
    const response = await request(app)
      .post("/events/missing-event/purchase")
      .set("Idempotency-Key", "missing-event-1")
      .send({ userId: "user-1", seatId: "seat-1" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("event_not_found");
  });

  it("returns 404 when the seat does not exist", async () => {
    await resetEvent(pool, {
      eventId: "test-seat-not-found",
      capacity: 1,
      seatCount: 1,
    });

    const response = await request(app)
      .post("/events/test-seat-not-found/purchase")
      .set("Idempotency-Key", "missing-seat-1")
      .send({ userId: "user-1", seatId: "seat-999" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("seat_not_found");

    const summary = await getEventSummary(pool, "test-seat-not-found");
    expect(Number(summary.sold_count)).toBe(0);
  });

  it("returns 409 when the seat is already sold", async () => {
    await resetEvent(pool, {
      eventId: "test-seat-sold",
      capacity: 2,
      seatCount: 2,
    });

    await request(app)
      .post("/events/test-seat-sold/purchase")
      .set("Idempotency-Key", "first-buy")
      .send({ userId: "user-1", seatId: "seat-1" })
      .expect(201);

    const response = await request(app)
      .post("/events/test-seat-sold/purchase")
      .set("Idempotency-Key", "second-buy")
      .send({ userId: "user-2", seatId: "seat-1" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("seat_sold");

    const summary = await getEventSummary(pool, "test-seat-sold");
    expect(Number(summary.sold_count)).toBe(1);
    expect(Number(summary.sold_seats)).toBe(1);
  });

  it("returns 409 when the event is sold out", async () => {
    await resetEvent(pool, {
      eventId: "test-sold-out",
      capacity: 1,
      seatCount: 2,
    });

    await request(app)
      .post("/events/test-sold-out/purchase")
      .set("Idempotency-Key", "fills-capacity")
      .send({ userId: "user-1", seatId: "seat-1" })
      .expect(201);

    const response = await request(app)
      .post("/events/test-sold-out/purchase")
      .set("Idempotency-Key", "after-sold-out")
      .send({ userId: "user-2", seatId: "seat-2" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("sold_out");

    const summary = await getEventSummary(pool, "test-sold-out");
    expect(Number(summary.sold_count)).toBe(1);
    expect(Number(summary.sold_seats)).toBe(1);
  });

  it("returns 409 when a matching request is already processing", async () => {
    const eventId = "test-processing-dup";
    const purchase = { userId: "user-1", seatId: "seat-1" };

    await resetEvent(pool, {
      eventId,
      capacity: 1,
      seatCount: 1,
    });

    await pool.query(
      `
        INSERT INTO idempotency_keys (event_id, key, request_hash, status)
        VALUES ($1, $2, $3, 'processing')
      `,
      [eventId, "in-flight-key", hashPurchaseRequest({ eventId, ...purchase })],
    );

    const response = await request(app)
      .post(`/events/${eventId}/purchase`)
      .set("Idempotency-Key", "in-flight-key")
      .send(purchase);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("duplicate_request_processing");
  });

  it("does not oversell under parallel load", async () => {
    const requests = 50;
    const capacity = 10;

    await resetEvent(pool, {
      eventId: "test-concurrent",
      capacity,
      seatCount: requests,
    });

    const responses = await Promise.all(
      Array.from({ length: requests }, (_unused, index) =>
        request(app)
          .post("/events/test-concurrent/purchase")
          .set("Idempotency-Key", `parallel-${index + 1}`)
          .send({
            userId: `user-${index + 1}`,
            seatId: `seat-${index + 1}`,
          }),
      ),
    );

    const successful = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.status === 409);

    expect(successful).toHaveLength(capacity);
    expect(rejected).toHaveLength(requests - capacity);

    const summary = await getEventSummary(pool, "test-concurrent");
    expect(Number(summary.sold_count)).toBe(capacity);
    expect(Number(summary.sold_seats)).toBe(capacity);
    expect(Number(summary.duplicate_sold_seats)).toBe(0);
  });

  it("only sells a seat once under parallel requests", async () => {
    const requests = 20;

    await resetEvent(pool, {
      eventId: "test-same-seat-concurrent",
      capacity: requests,
      seatCount: 1,
    });

    const responses = await Promise.all(
      Array.from({ length: requests }, (_unused, index) =>
        request(app)
          .post("/events/test-same-seat-concurrent/purchase")
          .set("Idempotency-Key", `same-seat-${index + 1}`)
          .send({
            userId: `user-${index + 1}`,
            seatId: "seat-1",
          }),
      ),
    );

    const successful = responses.filter((response) => response.status === 201);
    const rejected = responses.filter(
      (response) =>
        response.status === 409 && response.body.error.code === "seat_sold",
    );

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(requests - 1);

    const summary = await getEventSummary(pool, "test-same-seat-concurrent");
    expect(Number(summary.sold_count)).toBe(1);
    expect(Number(summary.sold_seats)).toBe(1);
    expect(Number(summary.duplicate_sold_seats)).toBe(0);
  });
});
