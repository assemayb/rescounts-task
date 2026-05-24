# Rescounts Task

Ticket purchase service focused on safe concurrent sales and idempotent retries.

## Stack

- Node.js 22+
- TypeScript
- Express
- PostgreSQL
- Vitest

## Quick Start

Run the full app with Docker Compose:

```bash
make up
```

The app listens on `http://localhost:3000`.
Postgres also creates a separate `rescounts_test` database for tests.

Seed the default event:

```bash
make seed
```

The seed script creates:

- Event: `concert-1`
- Capacity: `500`
- Seats: `seat-1` to `seat-500`

If the database schema or init SQL changes, recreate the local database volume:

```bash
make clean
make up
```

## Try the API

Health check:

```bash
curl http://localhost:3000/health
```

Purchase a ticket from the seeded event:

```bash
curl -X POST http://localhost:3000/events/concert-1/purchase \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: purchase-1" \
  -d '{"userId":"user-1","seatId":"seat-1"}'
```

## Validation

Run the checks inside the app container:

```bash
make test
make concurrency
```

## Scripts

```bash
make test
make concurrency
make migrate
make seed
```

## Design Notes

See `DESIGN.md` for the concurrency, idempotency, scaling, and tradeoff decisions behind the implementation.

## Structure

```text
src/
  app.ts
  routes/
  services/
  store/
  middleware/
tests/
  health.test.ts
  purchase.test.ts
sql/
  schema.sql
```

## API

```http
GET /health
```

```http
POST /events/:id/purchase
Idempotency-Key: unique-request-key
Content-Type: application/json

{
  "userId": "user-1",
  "seatId": "seat-1"
}
```
