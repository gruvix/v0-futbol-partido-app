CREATE TABLE IF NOT EXISTS fields (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  maps_url TEXT,
  cancellation_deadline_hours INTEGER NOT NULL DEFAULT 24,
  cancellation_reminder_offset_hours INTEGER NOT NULL DEFAULT 1,
  cancellation_penalty TEXT,
  notes TEXT,
  atc_venue_slug VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id);
CREATE INDEX IF NOT EXISTS idx_matches_field_id ON matches(field_id);

-- Seed (idempotent: only when empty)
INSERT INTO fields (name, slug, cancellation_penalty, notes, atc_venue_slug)
SELECT * FROM (VALUES
  ('Terrazas', 'terrazas', 'Cancelar con al menos 24h vía ATC; después se pierde la seña / se cobra el turno.', 'Castex 1745.', 'terrazas-bariloche'),
  ('Fénix', 'fenix', 'Cancelar con al menos 24h; fuera de plazo se cobra el alquiler completo.', 'Confirmar dirección/maps con admins.', NULL),
  ('Los Andes', 'los-andes', 'Cancelar ≥24h antes; tardío = 100% del turno.', 'Confirmar política/maps con predio.', NULL),
  ('Otra ubicación', 'otro', NULL, 'Predio no registrado; completar nombre al crear el partido.', NULL)
) AS seed(name, slug, cancellation_penalty, notes, atc_venue_slug)
WHERE NOT EXISTS (SELECT 1 FROM fields LIMIT 1);

UPDATE matches m
SET field_id = f.id
FROM fields f
WHERE m.field_id IS NULL
  AND (
    (m.location_type = 'TERRAZAS' AND f.slug = 'terrazas')
    OR (m.location_type = 'FENIX' AND f.slug = 'fenix')
    OR (m.location_type = 'OTRO' AND f.slug = 'otro')
  );
