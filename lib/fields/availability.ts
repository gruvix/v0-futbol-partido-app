import { fetchTerrazasAvailability } from '@/lib/terrazas'
import type {
  NormalizedAvailabilityResponse,
  NormalizedComplexAvailability,
  NormalizedFieldAvailability,
  NormalizedSlotAvailability,
} from '@/lib/fields/types'

function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseRequestedDate(raw: string | null | undefined): string {
  if (!raw) return formatDateYYYYMMDD(new Date())

  // Accept YYYY-MM-DD and also tolerate trailing garbage (previous test had a trailing "a")
  const match = raw.match(/\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return formatDateYYYYMMDD(new Date())
  return formatDateYYYYMMDD(d)
}

function normalizeTerrazas(
  args: { date: string; slots: NormalizedSlotAvailability[] }
): NormalizedComplexAvailability {
  const terrazasField: NormalizedFieldAvailability = {
    fieldId: 'default',
    fieldName: 'Cancha',
    slots: args.slots,
  }

  return {
    complexId: 'terrazas',
    complexName: 'Terrazas',
    date: args.date,
    fields: [terrazasField],
  }
}

export async function fetchAllComplexesAvailability(
  date: string
): Promise<NormalizedAvailabilityResponse> {
  const terrazasSlotsRaw = await fetchTerrazasAvailability(date)
  const terrazasSlots: NormalizedSlotAvailability[] = terrazasSlotsRaw.map((s) => ({
    time: s.time,
    available: s.available,
    price: s.price,
    availableFieldNames: s.availableFieldNames,
  }))

  const complexes: NormalizedComplexAvailability[] = [
    normalizeTerrazas({ date, slots: terrazasSlots }),
  ]

  return {
    date,
    complexes,
  }
}
