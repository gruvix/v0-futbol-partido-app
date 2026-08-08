-- Registration invites (invite-only signup gate)
-- Also applied automatically by lib/db.ts -> initializeDatabase().

CREATE TABLE IF NOT EXISTS user_registration_invites (
  id SERIAL PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email VARCHAR(255),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_invites_token_hash ON user_registration_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_registration_invites_created_by ON user_registration_invites(created_by_user_id);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id SERIAL PRIMARY KEY,
  bucket VARCHAR(100) NOT NULL,
  bucket_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_key_time ON rate_limit_events(bucket, bucket_key, created_at);
