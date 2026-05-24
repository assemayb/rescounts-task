# Design

## 1. Preventing Overselling

PostgreSQL is the source of truth for the purchase path. Each purchase runs inside a database transaction.

The service first locks the requested seat row with `SELECT ... FOR UPDATE`. This serializes concurrent attempts to buy the same seat, so only one request can observe and update that seat as available.

After the seat check, the service increments the event counter with a conditional update:

```sql
UPDATE events
SET sold_count = sold_count + 1
WHERE id = $1 AND sold_count < capacity
RETURNING sold_count, capacity
```

this statement is atomic. PostgreSQL serializes concurrent updates to the same event row, and each waiting transaction rechecks `sold_count < capacity` before applying its update. If capacity has already been reached, the update returns no row and the API returns `sold_out`.

The schema also protects the invariant:

```sql
CHECK (sold_count >= 0 AND sold_count <= capacity)
```

This means the application logic and database constraint both agree on the same rule: an event can never sell more than its configured capacity. For the task scenario, the seeded event has capacity `500`. The same logic is tested with smaller numbers in the automated tests and concurrency script so the proof is fast and repeatable.

Idempotency is handled in the same transaction as the purchase. The client provides an `Idempotency-Key`; the service stores the request hash and final response. A retry with the same key and same request returns the stored response. Reusing the same key for a different request returns a conflict with `409` status code.

This design holds as long as all writes for an event go through the database transaction path. It would break if another writer bypassed these constraints, or if event capacity were changed carelessly while purchases are in flight.

## 2. Scaling to 500,000 Concurrent Users

The current implementation is not optimized for extreme throughput. At 500,000 concurrent users, the event row becomes a hot row because every successful purchase must increment the same counter. PostgreSQL will preserve correctness, but many requests will wait on locks and latency will climb.

To scale this safely across multiple app servers, I would keep PostgreSQL as the final source of truth and add a front-door admission layer:

- A waiting room or queue to smooth the initial traffic spike.
- Rate limits per user and idempotency key to reduce duplicate pressure.
- A short-lived hold token. Admitted users receive a token that expires after a small window, and only requests with a valid hold token can attempt the transactional purchase.
- Horizontal app servers behind a load balancer, all sharing the same database.

For higher throughput and future optimization, the counter could be partitioned by ticket blocks or contained inside bigger sections of seats. For example, if the event has 1000 seats, I would partition the counter into 10 blocks of 100 seats each.  
Then, the service would increment the counter for the block that contains the purchased seat. This would reduce the contention on the event row and improve the throughput. Also makes the events more organized and easier to manage.

Redis could help with admission control or rate limiting, but I would not treat Redis as the final purchase record. The database transaction should remain the authority that decides whether a ticket was actually sold and Postgres excels at these types of situations.

## 3. Intentional Tradeoffs

I did not build a full event management API. Events and seats are created through the seed script because the task is focused on the critical purchase path.

I did not implement authentication or per-user purchase limits. The API accepts `userId` directly in the request body. In a real system, this would come from an authenticated session or token.

I did not build payment processing, refunds, reservation expiry, or order reconciliation. Those are core parts of a production system, but they would add flows outside the concurrency and idempotency problem being evaluated.

I did not add Redis or a distributed lock service. PostgreSQL transactions are enough for this implementation, easier to reason about, and keep the correctness proof close to the stored data.

I did not complicate the design and architecture with things like full-on dependency injection, logging, metrics, tracing, or other production-grade features. The focus is on the concurrency and idempotency problem being evaluated.

I did not use any external tools like k6, apache bench or other performance testing tools. I focused on the concurrency and idempotency problem being evaluated using native Node.js tools.

I kept tests and scripts Docker-friendly rather than production-minimal. The app container includes the tooling needed to run tests and scripts so reviewers can use one simple workflow:

```bash
make up
make seed
make test
make concurrency
```

