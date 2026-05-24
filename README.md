# Rescounts Task

Revised skeleton for the ticket counting service.

## Stack

- Node.js 22+
- TypeScript
- Express
- PostgreSQL
- Vitest

## Setup

Run the full app with Docker Compose:

```bash
make up
```

The Docker Compose app listens on `http://localhost:3000`.
Postgres also creates a separate `rescounts_test` database for tests.

If the database schema or init SQL changes, recreate the local database volume:

```bash
make clean
make up
```

Seed the default event:

```bash
make seed
```

Run tests inside the app container:

```bash
make test
make concurrency
```

## Scripts

```bash
make build
make typecheck
make test
make concurrency
make migrate
make seed
```

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
