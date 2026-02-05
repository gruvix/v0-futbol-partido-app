-- Add new columns to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_count INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 5;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS field VARCHAR(100);

-- Create match_admins table
CREATE TABLE IF NOT EXISTS match_admins (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_match_admins_match ON match_admins(match_id);
CREATE INDEX IF NOT EXISTS idx_match_admins_user ON match_admins(user_id);

-- Add team column to match_participants to support dynamic teams (1, 2, 3, etc.)
-- We already have team_side enum ('A', 'B'), we'll keep that for backwards compatibility
-- but add a team_number column for more than 2 teams
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS team_number INTEGER;
