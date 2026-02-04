import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

export type MatchVisibility = 'PUBLIC' | 'PRIVATE'
export type ResultTeam = 'A' | 'B' | 'DRAW'

export async function initializeDatabase() {
  // Create enum types (ignore if already exists)
  try {
    await sql`CREATE TYPE location_type AS ENUM ('TERRAZAS', 'FENIX', 'OTRO')`
  } catch {
    // Type already exists
  }
  
  try {
    await sql`CREATE TYPE participant_role AS ENUM ('PLAYER', 'SUBSTITUTE', 'EXTRA')`
  } catch {
    // Type already exists
  }
  
  try {
    await sql`CREATE TYPE team_side AS ENUM ('A', 'B')`
  } catch {
    // Type already exists
  }
  
  // New enum types for visibility and results
  try {
    await sql`CREATE TYPE match_visibility AS ENUM ('PUBLIC', 'PRIVATE')`
  } catch {
    // Type already exists
  }
  
  try {
    await sql`CREATE TYPE result_team AS ENUM ('A', 'B', 'DRAW')`
  } catch {
    // Type already exists
  }

  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone_last_four VARCHAR(4) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_approved BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(name, phone_last_four)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS pending_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone_last_four VARCHAR(4) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(name, phone_last_four)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(100),
      emoji VARCHAR(10),
      date_time TIMESTAMP WITH TIME ZONE NOT NULL,
      location_type location_type NOT NULL DEFAULT 'TERRAZAS',
      location_custom VARCHAR(255),
      visibility match_visibility DEFAULT 'PUBLIC',
      result_winner result_team,
      result_score_a INTEGER,
      result_score_b INTEGER,
      result_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
  
  // Add columns if they don't exist (for existing databases)
  try {
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(100)`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS emoji VARCHAR(10)`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS visibility match_visibility DEFAULT 'PUBLIC'`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_winner result_team`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_score_a INTEGER`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_score_b INTEGER`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_notes TEXT`
  } catch {
    // Columns might already exist
  }

  await sql`
    CREATE TABLE IF NOT EXISTS match_participants (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role participant_role NOT NULL DEFAULT 'PLAYER',
      team team_side,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(match_id, user_id)
    )
  `

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_date_time ON matches(date_time)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by_user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_visibility ON matches(visibility)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_date_visibility ON matches(date_time, visibility)`

  return { success: true }
}
