/**
 * Match times are Argentina wall clock, persisted as UTC clock values.
 * User picks 18:00 → store 18:00Z → display getUTC* as 18:00.
 * Compare "ended" against now in America/Argentina/Buenos_Aires, not UTC instant.
 */
export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'

export type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function zonedParts(date: Date, timeZone = APP_TIMEZONE): DateParts {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const parts: Record<string, string> = {}
  for (const part of raw) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  }
}

export function matchWallClock(iso: string | Date): DateParts {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  }
}

function partsToComparableMs(parts: DateParts): number {
  return Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)
}

export function isMatchPast(iso: string | Date, now = new Date()): boolean {
  return partsToComparableMs(matchWallClock(iso)) < partsToComparableMs(zonedParts(now))
}

export function wallClockToStoredIso(dateStr: string, timeStr: string): string {
  const [hours = '00', minutes = '00', seconds = '00'] = timeStr.split(':')
  return `${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.000Z`
}

export function formatYmd(parts: Pick<DateParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export function addCalendarDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`
}

export function ymdToUtcDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function argentinaCalendarDayStartIso(now = new Date(), dayOffset = 0): string {
  const parts = zonedParts(now)
  return new Date(Date.UTC(parts.year, parts.month, parts.day + dayOffset, 0, 0, 0)).toISOString()
}
