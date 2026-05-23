# Rescounts Task

Revised skeleton for the ticket counting service.

## Stack

- Node.js 22+
- TypeScript
- Express
- PostgreSQL
- Vitest

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run db:migrate
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
sql/
  schema.sql
```

## Current API

```http
GET /health
```

Returns basic service status while the domain model is rebuilt.
