CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0 AND capacity <= 500),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0 AND sold_count <= capacity),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seats (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  sold_to_user_id TEXT,
  sold_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, seat_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, key)
);

CREATE INDEX IF NOT EXISTS seats_event_status_idx ON seats(event_id, status);
