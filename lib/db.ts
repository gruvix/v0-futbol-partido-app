import { neon } from '@neondatabase/serverless'

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    // Throw a more actionable error than the default one (and avoid non-null assertion).
    throw new Error(
      "Missing DATABASE_URL env var. Create a .env.local with DATABASE_URL='postgres://...' (Neon connection string)"
    )
  }
  return url
}

export const sql = neon(getDatabaseUrl())

export async function initializeDatabase() {
  // Create enum types (ignore if already exists)
  try {
    await sql`CREATE TYPE location_type AS ENUM ('TERRAZAS', 'FENIX', 'OTRO')`
  } catch {
    // Type already exists
  }

  try {
    await sql`CREATE TYPE user_gender AS ENUM ('MALE', 'FEMALE', 'OTHER')`
  } catch {
    // Type already exists
  }
  
  try {
    await sql`CREATE TYPE participant_role AS ENUM ('PLAYER', 'SUBSTITUTE')`
  } catch {
    // Type already exists
  }
  
  try {
    await sql`CREATE TYPE team_side AS ENUM ('A', 'B')`
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
      admin BOOLEAN DEFAULT false,
      gender user_gender NOT NULL DEFAULT 'MALE',
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
      gender user_gender NOT NULL DEFAULT 'MALE',
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
      field VARCHAR(100),
      is_public BOOLEAN DEFAULT true,
      team_count INTEGER DEFAULT 0,
      team_size INTEGER DEFAULT 5,
      max_players INTEGER DEFAULT 10,
      invites_per_player INTEGER,
      field_rent_total INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
  
  // Match admins table (players who can configure the match)
  await sql`
    CREATE TABLE IF NOT EXISTS match_admins (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(match_id, user_id)
    )
  `

  // Track who invited whom (for invite limits)
  await sql`
    CREATE TABLE IF NOT EXISTS match_invites (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      inviter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(match_id, inviter_user_id, invited_user_id)
    )
  `
  
  // Add columns if they don't exist (for existing databases)
  // Note: match_participants might not exist yet, so keep those ALTERs isolated.
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender user_gender NOT NULL DEFAULT 'MALE'`
    await sql`ALTER TABLE pending_users ADD COLUMN IF NOT EXISTS gender user_gender NOT NULL DEFAULT 'MALE'`

    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(100)`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS emoji VARCHAR(10)`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_count INTEGER DEFAULT 0`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 5`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS field VARCHAR(100)`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 10`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS invites_per_player INTEGER`
    await sql`ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS team_number INTEGER`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT false`
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS field_rent_total INTEGER`
  } catch {
    // Columns might already exist
  }

  try {
    await sql`ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS team_number INTEGER`
    await sql`ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT false`
    await sql`ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS payment_notes TEXT`
  } catch {
    // Table might not exist yet
  }

  await sql`
    CREATE TABLE IF NOT EXISTS match_participants (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role participant_role NOT NULL DEFAULT 'PLAYER',
      team team_side,
      team_number INTEGER,
      has_paid BOOLEAN DEFAULT false,
      payment_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(match_id, user_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS stats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      pac INTEGER NOT NULL DEFAULT 5 CHECK (pac BETWEEN 0 AND 10),
      sho INTEGER NOT NULL DEFAULT 5 CHECK (sho BETWEEN 0 AND 10),
      pas INTEGER NOT NULL DEFAULT 5 CHECK (pas BETWEEN 0 AND 10),
      dri INTEGER NOT NULL DEFAULT 5 CHECK (dri BETWEEN 0 AND 10),
      def INTEGER NOT NULL DEFAULT 5 CHECK (def BETWEEN 0 AND 10),
      phy INTEGER NOT NULL DEFAULT 5 CHECK (phy BETWEEN 0 AND 10),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
  // Backward compatibility:
  // Old DBs may already have participant_role including 'EXTRA'. We want to:
  // 1) migrate any existing rows role=EXTRA -> SUBSTITUTE
  // 2) rebuild the enum without EXTRA (safest cross-version approach)
  try {
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'participant_role'
            AND e.enumlabel = 'EXTRA'
        ) THEN
          -- Data migration
          UPDATE match_participants SET role = 'SUBSTITUTE' WHERE role = 'EXTRA';

          -- Rebuild enum without EXTRA
          CREATE TYPE participant_role_new AS ENUM ('PLAYER', 'SUBSTITUTE');

          ALTER TABLE match_participants
            ALTER COLUMN role TYPE text;

          ALTER TABLE match_participants
            ALTER COLUMN role TYPE participant_role_new
            USING role::participant_role_new;

          DROP TYPE participant_role;
          ALTER TYPE participant_role_new RENAME TO participant_role;
        END IF;
      END $$;
    `
  } catch {
    // Ignore: migration is best-effort (permissions/pg version differences/etc)
  }

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_date_time ON matches(date_time)`
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by_user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_admins_match ON match_admins(match_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_match_admins_user ON match_admins(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_stats_user ON stats(user_id)`

  return { success: true }
}
