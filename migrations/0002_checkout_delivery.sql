CREATE TABLE IF NOT EXISTS checkout_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  session_id TEXT,
  integration_label TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
ALTER TABLE licences ADD COLUMN welcome_sent_at INTEGER;
