-- Email auth
-- Adds:
-- - users.email (VARCHAR, nullable - existing users have none, new registrations require it)
-- - pending_users.email (VARCHAR, nullable, kept in sync with users)
-- - case-insensitive unique index on users.email (ignores NULLs)
-- - password_reset_tokens table (email-based password recovery)
--
-- Note: this is also applied automatically by lib/db.ts -> initializeDatabase(),
-- which runs on every dashboard load. This script exists for manual/documentation use.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE pending_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwreset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwreset_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS email_change_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_change_token_hash ON email_change_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_change_user_id ON email_change_tokens(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_users_email_unique
  ON pending_users(lower(email))
  WHERE email IS NOT NULL;
