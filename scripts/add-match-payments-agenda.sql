-- Match payments agenda
-- Adds:
-- - matches.field_rent_total (INTEGER)
-- - match_participants.has_paid (BOOLEAN)
-- - match_participants.payment_notes (TEXT)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS field_rent_total INTEGER;

ALTER TABLE match_participants
  ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT false;

ALTER TABLE match_participants
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;
