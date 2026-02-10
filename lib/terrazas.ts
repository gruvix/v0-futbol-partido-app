export interface SlotAvailability {
  time: string
  available: boolean
  price?: number
  /** Optional: which courts are available for this time (if we can infer it) */
  availableFieldNames?: string[]
}

/**
 * Fetches availability from ATC Sports for the Terrazas Bariloche venue.
 * It attempts to parse the __NEXT_DATA__ script payload to remain stable
 * even if the rendered HTML changes.
 */
export async function fetchTerrazasAvailability(date: string): Promise<SlotAvailability[]> {
  const formattedDate = formatDate(date)
  const url = `https://atcsports.io/venues/terrazas-bariloche?dia=${formattedDate}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'v0-futbol-partido-app/terrazas-scraper',
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`ATC Sports responded with ${res.status}`)
  }

  const html = await res.text()
  const data = extractNextData(html)

  const slots = data ? extractSlots(data) : []

  if (slots.length > 0) {
    return dedupeSlots(slots)
  }

  // Fallback: very defensive regex scan in case the data shape changes
  return dedupeSlots(extractSlotsFromHtml(html))
}

function formatDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date')
  }
  return d.toISOString().split('T')[0]
}

function extractNextData(html: string): unknown | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  )
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const CONTEXT_WINDOW_SIZE = 50
const TIME_REGEX = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

function extractSlotsFromHtml(html: string): SlotAvailability[] {
  const results: SlotAvailability[] = []
  let match: RegExpExecArray | null

  while ((match = TIME_REGEX.exec(html)) !== null) {
    const time = `${match[1].padStart(2, '0')}:${match[2]}`
    // Peek around the match for availability keywords
    const context = html.slice(
      Math.max(0, match.index - CONTEXT_WINDOW_SIZE),
      match.index + CONTEXT_WINDOW_SIZE
    )
    const available =
      /disponible|available|true/i.test(context) && !/no\s+disponible|false/i.test(context)
    results.push({ time, available })
  }

  return results
}

function extractSlots(payload: unknown): SlotAvailability[] {
  const results: SlotAvailability[] = []
  const visited = new WeakSet<object>()

  // First, attempt the richest/most stable extraction: available_courts -> available_slots
  // This gives us court-per-time availability (needed for the UI like: "03:00 - Cancha 1,2,5").
  const fromCourts = extractSlotsFromAvailableCourts(payload)
  if (fromCourts.length > 0) {
    return dedupeSlots(mergeSlotLists(results, fromCourts))
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (visited.has(node as object)) return
    visited.add(node as object)

    if (Array.isArray(node)) {
      // Direct array of slot-like objects
      if (
        node.every(
          (item) =>
            item &&
            typeof item === 'object' &&
            (hasTimeLike(item as Record<string, unknown>) ||
              ('hora' in (item as Record<string, unknown>)))
        )
      ) {
        node.forEach((item) => {
          const record = item as Record<string, unknown>
          const time = getTimeValue(record)
          if (!time) return
          results.push({
            time,
            available: getAvailabilityValue(record),
            price: getPriceValue(record),
          })
        })
        return
      }
      node.forEach(walk)
      return
    }

    const record = node as Record<string, unknown>
    // Common key in ATC payloads
    if (Array.isArray(record.bloques)) {
      walk(record.bloques)
    }

    Object.values(record).forEach(walk)
  }

  walk(payload)
  return results
}

function mergeSlotLists(a: SlotAvailability[], b: SlotAvailability[]): SlotAvailability[] {
  return [...a, ...b]
}

interface AvailableCourtSlot {
  start?: unknown
  duration?: unknown
  price?: unknown
}

interface AvailableCourt {
  id?: unknown
  name?: unknown
  available_slots?: unknown
}

function extractSlotsFromAvailableCourts(payload: unknown): SlotAvailability[] {
  const root = payload as {
    props?: {
      pageProps?: {
        sportclub?: {
          available_courts?: AvailableCourt[]
        }
      }
    }
  }

  const courts = root?.props?.pageProps?.sportclub?.available_courts
  if (!Array.isArray(courts) || courts.length === 0) return []

  // Map: time -> set of court names
  const byTime = new Map<string, Set<string>>()
  const priceByTime = new Map<string, number>()

  for (const court of courts) {
    const courtName = typeof court?.name === 'string' ? court.name : null
    if (!courtName) continue

    const slots = (court as AvailableCourt)?.available_slots
    if (!Array.isArray(slots)) continue

    for (const slot of slots as AvailableCourtSlot[]) {
      const start = typeof slot?.start === 'string' ? slot.start : null
      if (!start) continue
      const dt = new Date(start)
      if (Number.isNaN(dt.getTime())) continue
      const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`

      const set = byTime.get(time) ?? new Set<string>()
      set.add(courtName)
      byTime.set(time, set)

      const price = extractPriceFromCourtSlot(slot)
      if (price !== undefined) {
        // keep the minimum price seen for the time, if multiple courts have different prices
        const existing = priceByTime.get(time)
        if (existing === undefined || price < existing) priceByTime.set(time, price)
      }
    }
  }

  const results: SlotAvailability[] = Array.from(byTime.entries())
    .map(([time, courtsSet]) => ({
      time,
      available: courtsSet.size > 0,
      price: priceByTime.get(time),
      availableFieldNames: Array.from(courtsSet.values()).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  return results
}

function extractPriceFromCourtSlot(slot: AvailableCourtSlot): number | undefined {
  // Known shape: price: { cents: 7000000, currency: 'ARS' }
  const price = slot.price as { cents?: unknown } | undefined
  if (price && typeof price === 'object' && typeof price.cents === 'number') {
    // cents in payload appear to have 2 decimals implied; convert to currency unit.
    return price.cents / 100
  }
  return undefined
}

function hasTimeLike(record: Record<string, unknown>) {
  return (
    typeof record.time === 'string' ||
    typeof record.hour === 'string' ||
    typeof record.hora === 'string' ||
    typeof record.horario === 'string'
  )
}

function getTimeValue(record: Record<string, unknown>): string | null {
  const candidate =
    record.time || record.hour || record.hora || record.horario || record.slot || record.horario_desde
  if (typeof candidate === 'string') {
    const normalized = candidate.trim()
    const match = normalized.match(TIME_REGEX)
    if (match) {
      const [, hh, mm] = match
      if (hh && mm) {
        return `${hh.padStart(2, '0')}:${mm}`
      }
    }
    return null
  }
  return null
}

function getAvailabilityValue(record: Record<string, unknown>): boolean {
  const availabilityFields = [
    'disponible',
    'available',
    'isAvailable',
    'disponibilidad',
    'free',
    'libre',
  ]

  for (const key of availabilityFields) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    if (typeof value === 'string') {
      if (/true|si|yes|disponible/i.test(value)) return true
      if (/false|no/i.test(value)) return false
    }
  }

  return false
}

function getPriceValue(record: Record<string, unknown>): number | undefined {
  const priceFields = ['price', 'precio', 'monto', 'amount']
  for (const key of priceFields) {
    const value = record[key]
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const numeric = Number(value.replace(/[^0-9.]/g, ''))
      if (!Number.isNaN(numeric)) return numeric
    }
  }
  return undefined
}

function dedupeSlots(slots: SlotAvailability[]): SlotAvailability[] {
  const seen = new Map<string, SlotAvailability>()
  for (const slot of slots) {
    if (!slot.time) continue
    const existing = seen.get(slot.time)
    if (!existing) {
      seen.set(slot.time, slot)
    } else {
      const shouldReplaceAvailability = !existing.available && slot.available
      const shouldMergePrice = slot.price !== undefined && existing.price === undefined

      const mergedAvailableFieldNames = mergeFieldNames(
        existing.availableFieldNames,
        slot.availableFieldNames
      )

      if (shouldReplaceAvailability || shouldMergePrice) {
        seen.set(slot.time, { ...existing, ...slot, availableFieldNames: mergedAvailableFieldNames })
      } else if (mergedAvailableFieldNames) {
        // Even if we don't replace other fields, we still want to union the court list.
        seen.set(slot.time, { ...existing, availableFieldNames: mergedAvailableFieldNames })
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.time.localeCompare(b.time))
}

function mergeFieldNames(
  a: string[] | undefined,
  b: string[] | undefined
): string[] | undefined {
  if (!a && !b) return undefined
  const set = new Set<string>()
  for (const name of a ?? []) set.add(name)
  for (const name of b ?? []) set.add(name)
  return Array.from(set.values()).sort((x, y) => x.localeCompare(y))
}
