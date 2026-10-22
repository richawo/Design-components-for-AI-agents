-- OAuth 2.1 sign-in for MCP clients (Claude, ChatGPT, Cursor, VS Code, Codex).
-- Clients register dynamically (RFC 7591). Codes and tokens are stored only as
-- AUTH_SECRET digests. One grant row holds the current access and refresh token
-- of one approved connection; refresh rotates both.
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  secret_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_grants (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL,
  access_hash TEXT NOT NULL UNIQUE,
  access_expires_at INTEGER NOT NULL,
  refresh_hash TEXT NOT NULL UNIQUE,
  refresh_expires_at INTEGER NOT NULL,
  previous_refresh_hash TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_grants_user ON oauth_grants(user_id);
CREATE INDEX IF NOT EXISTS oauth_grants_previous ON oauth_grants(previous_refresh_hash);
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  grant_id TEXT
);
CREATE INDEX IF NOT EXISTS oauth_codes_expiry ON oauth_codes(expires_at);
