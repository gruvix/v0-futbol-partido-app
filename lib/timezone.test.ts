import { describe, expect, it } from 'vitest'

import {
  addCalendarDaysYmd,
  argentinaCalendarDayStartIso,
  isMatchPast,
  wallClockToStoredIso,
  zonedParts,
} from './timezone'

describe('timezone', () => {
  it('stores Argentina wall clock as UTC clock values', () => {
    expect(wallClockToStoredIso('2026-10-22', '18:00')).toBe('2026-10-22T18:00:00.000Z')
  })

  it('treats 18:00 match as live at 15:00 Argentina (18:00 UTC)', () => {
    const now = new Date('2026-10-22T18:00:00.000Z') // 15:00 ART
    expect(isMatchPast('2026-10-22T18:00:00.000Z', now)).toBe(false)
  })

  it('treats 18:00 match as ended after 18:00 Argentina', () => {
    const now = new Date('2026-10-22T21:00:01.000Z') // 18:00:01 ART
    expect(isMatchPast('2026-10-22T18:00:00.000Z', now)).toBe(true)
  })

  it('reads now in Argentina, not UTC date', () => {
    const lateEveningArt = new Date('2026-10-23T01:30:00.000Z') // 22:30 ART on 22nd
    const parts = zonedParts(lateEveningArt)
    expect(parts.year).toBe(2026)
    expect(parts.month).toBe(9)
    expect(parts.day).toBe(22)
    expect(parts.hour).toBe(22)
    expect(parts.minute).toBe(30)
  })

  it('starts Argentina calendar day at 00:00 stored UTC', () => {
    const now = new Date('2026-10-22T18:00:00.000Z')
    expect(argentinaCalendarDayStartIso(now)).toBe('2026-10-22T00:00:00.000Z')
    expect(argentinaCalendarDayStartIso(now, -7)).toBe('2026-10-15T00:00:00.000Z')
  })

  it('adds calendar days on YMD without timezone shift', () => {
    expect(addCalendarDaysYmd('2026-10-22', 1)).toBe('2026-10-23')
    expect(addCalendarDaysYmd('2026-10-31', 1)).toBe('2026-11-01')
  })
})
