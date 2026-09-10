import { sql } from './db'

export type Field = {
  id: number
  name: string
  slug: string
  maps_url: string | null
  cancellation_deadline_hours: number
  cancellation_reminder_offset_hours: number
  cancellation_penalty: string | null
  notes: string | null
  atc_venue_slug: string | null
  is_active: boolean
}

export type FieldInput = {
  name: string
  slug: string
  maps_url?: string | null
  cancellation_deadline_hours: number
  cancellation_reminder_offset_hours: number
  cancellation_penalty?: string | null
  notes?: string | null
  atc_venue_slug?: string | null
  is_active?: boolean
}

function rowToField(row: Record<string, unknown>): Field {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    maps_url: row.maps_url != null ? String(row.maps_url) : null,
    cancellation_deadline_hours: Number(row.cancellation_deadline_hours),
    cancellation_reminder_offset_hours: Number(row.cancellation_reminder_offset_hours),
    cancellation_penalty: row.cancellation_penalty != null ? String(row.cancellation_penalty) : null,
    notes: row.notes != null ? String(row.notes) : null,
    atc_venue_slug: row.atc_venue_slug != null ? String(row.atc_venue_slug) : null,
    is_active: Boolean(row.is_active),
  }
}

export function normalizeFieldSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function listFields(includeInactive = false): Promise<Field[]> {
  const rows = includeInactive
    ? await sql`SELECT * FROM fields ORDER BY is_active DESC, name ASC`
    : await sql`SELECT * FROM fields WHERE is_active = true ORDER BY name ASC`
  return rows.map((row) => rowToField(row as Record<string, unknown>))
}

export async function getFieldById(id: number): Promise<Field | null> {
  const rows = await sql`SELECT * FROM fields WHERE id = ${id}`
  if (!rows[0]) return null
  return rowToField(rows[0] as Record<string, unknown>)
}

export async function getFieldBySlug(slug: string): Promise<Field | null> {
  const normalized = normalizeFieldSlug(slug)
  const rows = await sql`SELECT * FROM fields WHERE slug = ${normalized}`
  if (!rows[0]) return null
  return rowToField(rows[0] as Record<string, unknown>)
}

export async function createField(input: FieldInput): Promise<Field> {
  const slug = normalizeFieldSlug(input.slug)
  if (!slug) {
    throw new Error('Slug invalido')
  }

  const rows = await sql`
    INSERT INTO fields (
      name, slug, maps_url,
      cancellation_deadline_hours, cancellation_reminder_offset_hours,
      cancellation_penalty, notes, atc_venue_slug, is_active
    )
    VALUES (
      ${input.name.trim()},
      ${slug},
      ${input.maps_url?.trim() || null},
      ${input.cancellation_deadline_hours},
      ${input.cancellation_reminder_offset_hours},
      ${input.cancellation_penalty?.trim() || null},
      ${input.notes?.trim() || null},
      ${input.atc_venue_slug?.trim() || null},
      ${input.is_active ?? true}
    )
    RETURNING *
  `
  return rowToField(rows[0] as Record<string, unknown>)
}

export async function updateField(id: number, input: Partial<FieldInput>): Promise<Field> {
  const existing = await getFieldById(id)
  if (!existing) {
    throw new Error('Cancha no encontrada')
  }

  const slug = input.slug != null ? normalizeFieldSlug(input.slug) : existing.slug
  if (!slug) {
    throw new Error('Slug invalido')
  }

  const rows = await sql`
    UPDATE fields SET
      name = ${input.name?.trim() ?? existing.name},
      slug = ${slug},
      maps_url = ${input.maps_url !== undefined ? (input.maps_url?.trim() || null) : existing.maps_url},
      cancellation_deadline_hours = ${input.cancellation_deadline_hours ?? existing.cancellation_deadline_hours},
      cancellation_reminder_offset_hours = ${input.cancellation_reminder_offset_hours ?? existing.cancellation_reminder_offset_hours},
      cancellation_penalty = ${input.cancellation_penalty !== undefined ? (input.cancellation_penalty?.trim() || null) : existing.cancellation_penalty},
      notes = ${input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes},
      atc_venue_slug = ${input.atc_venue_slug !== undefined ? (input.atc_venue_slug?.trim() || null) : existing.atc_venue_slug},
      is_active = ${input.is_active ?? existing.is_active},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return rowToField(rows[0] as Record<string, unknown>)
}

export async function deactivateField(id: number): Promise<void> {
  const inUse = await sql`SELECT id FROM matches WHERE field_id = ${id} LIMIT 1`
  if (inUse.length > 0) {
    await sql`UPDATE fields SET is_active = false, updated_at = NOW() WHERE id = ${id}`
    return
  }
  await sql`UPDATE fields SET is_active = false, updated_at = NOW() WHERE id = ${id}`
}

/** Map field slug to legacy location_type for backward compatibility. */
export function fieldSlugToLocationType(slug: string): 'TERRAZAS' | 'FENIX' | 'OTRO' {
  if (slug === 'terrazas') return 'TERRAZAS'
  if (slug === 'fenix') return 'FENIX'
  return 'OTRO'
}
