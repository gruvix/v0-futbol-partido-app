-- Add max_players column to matches (calculated from team_count * team_size, or explicit when no teams)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 10;

-- Add invites_per_player column to matches (null = unlimited)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS invites_per_player INTEGER DEFAULT NULL;

-- Create table to track who invited whom (for invite limits)
CREATE TABLE IF NOT EXISTS match_invites (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  inviter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_invites_match ON match_invites(match_id);
CREATE INDEX IF NOT EXISTS idx_match_invites_inviter ON match_invites(match_id, inviter_user_id);

-- Update existing matches: set max_players based on team_count * team_size
UPDATE matches SET max_players = CASE
  WHEN team_count > 0 THEN team_count * team_size
  ELSE 10
END WHERE max_players IS NULL OR max_players = 10;
