-- Migration helper: remove deprecated participant_role value 'EXTRA'
--
-- New allowed roles: PLAYER, SUBSTITUTE
-- Policy: EXTRA is now treated as SUBSTITUTE.

BEGIN;

-- 1) Data migration: EXTRA -> SUBSTITUTE
UPDATE match_participants
SET role = 'SUBSTITUTE'
WHERE role = 'EXTRA';

-- 2) Rebuild enum without EXTRA (safe across PG versions)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'participant_role'
      AND e.enumlabel = 'EXTRA'
  ) THEN
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

COMMIT;
