PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  stripe_customer_id TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_login_codes (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(key, window)
);
CREATE TABLE IF NOT EXISTS licences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  subscription_id TEXT UNIQUE,
  payment_intent_id TEXT,
  plan TEXT NOT NULL,
  seats INTEGER NOT NULL,
  status TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS licences_owner ON licences(user_id);
CREATE INDEX IF NOT EXISTS licences_payment ON licences(payment_intent_id);
CREATE TABLE IF NOT EXISTS team_members (
  licence_id TEXT NOT NULL REFERENCES licences(id),
  email TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(licence_id, email)
);
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_locks (
  user_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS paid_invoices (
  invoice_id TEXT PRIMARY KEY,
  licence_id TEXT NOT NULL REFERENCES licences(id),
  payment_intent_id TEXT,
  created_at INTEGER NOT NULL
);
