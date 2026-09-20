const LEGACY_LOCATION_LABELS: Record<string, string> = {
  TERRAZAS: 'Terrazas',
  FENIX: 'Fenix',
  OTRO: 'Otro',
}

export type MatchVenueInfo = {
  field_id?: number | null
  field_name?: string | null
  field_slug?: string | null
  location_type: string
  location_custom?: string | null
}

export function getMatchVenueLabel(match: MatchVenueInfo): string {
  if (match.field_slug === 'otro' && match.location_custom?.trim()) {
    return match.location_custom.trim()
  }
  if (match.field_name?.trim()) {
    return match.field_name.trim()
  }
  if (match.location_type === 'OTRO' && match.location_custom?.trim()) {
    return match.location_custom.trim()
  }
  return LEGACY_LOCATION_LABELS[match.location_type] || match.location_type
}

export function getCancellationPolicySummary(match: {
  cancellation_deadline_hours?: number | null
  cancellation_penalty?: string | null
}): string | null {
  const hours = match.cancellation_deadline_hours
  const penalty = match.cancellation_penalty?.trim()
  if (hours == null && !penalty) return null
  const parts: string[] = []
  if (hours != null) {
    parts.push(`Cancelar con al menos ${hours}h de anticipación`)
  }
  if (penalty) {
    parts.push(penalty)
  }
  return parts.join('. ')
}
