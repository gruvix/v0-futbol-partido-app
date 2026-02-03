export interface SlotAvailability {
  time: string
  available: boolean
  price?: number
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

function extractSlotsFromHtml(html: string): SlotAvailability[] {
  const results: SlotAvailability[] = []
  const timeRegex = /(\d{1,2}:\d{2})/g
  let match: RegExpExecArray | null

  while ((match = timeRegex.exec(html)) !== null) {
    const time = match[1]
    // Peek around the match for availability keywords
    const context = html.slice(Math.max(0, match.index - 50), match.index + 50)
    const available =
      /disponible|available|true/i.test(context) && !/no\s+disponible|false/i.test(context)
    results.push({ time, available })
  }

  return results
}

function extractSlots(payload: unknown): SlotAvailability[] {
  const results: SlotAvailability[] = []
  const visited = new WeakSet<object>()

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
    const match = normalized.match(/(\d{1,2}:\d{2})/)
    return match ? match[1] : normalized
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
    } else if (!existing.available && slot.available) {
      // Prefer availability=true if conflicting data
      seen.set(slot.time, slot)
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.time.localeCompare(b.time))
}
