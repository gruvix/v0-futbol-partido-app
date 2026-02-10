export interface NormalizedSlotAvailability {
  /** HH:mm (24h) */
  time: string
  available: boolean
  price?: number
  /** If known, which field/court names are available at this time */
  availableFieldNames?: string[]
}

export interface NormalizedFieldAvailability {
  /** Stable id within a complex (e.g. "main" or "cancha-1") */
  fieldId: string
  fieldName: string
  slots: NormalizedSlotAvailability[]
}

export interface NormalizedComplexAvailability {
  complexId: string
  complexName: string
  date: string // YYYY-MM-DD
  fields: NormalizedFieldAvailability[]
}

export interface NormalizedAvailabilityResponse {
  date: string // YYYY-MM-DD
  complexes: NormalizedComplexAvailability[]
}
