-- Add visibility enum type
DO $$ BEGIN
  CREATE TYPE match_visibility AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add result team enum type for match results
DO $$ BEGIN
  CREATE TYPE result_team AS ENUM ('A', 'B', 'DRAW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add visibility column to matches table (default PUBLIC for existing matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS visibility match_visibility DEFAULT 'PUBLIC';

-- Add result columns for match history
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_winner result_team;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_score_a INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_score_b INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_notes TEXT;

-- Create index on visibility for efficient filtering
CREATE INDEX IF NOT EXISTS idx_matches_visibility ON matches(visibility);

-- Create composite index for dashboard queries (date + visibility)
CREATE INDEX IF NOT EXISTS idx_matches_date_visibility ON matches(date_time, visibility);
