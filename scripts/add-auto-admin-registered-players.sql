-- Adds an opt-in match setting to auto-admin active registered official players.
-- Production note: review before running, and execute only after explicit approval.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS auto_admin_registered_players BOOLEAN DEFAULT false;
