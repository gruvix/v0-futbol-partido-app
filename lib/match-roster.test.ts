import { describe, expect, it } from 'vitest'

import { computeRosterPolicy, computeMatchCapacity, type RosterParticipant } from './match-roster'

function participant(id: number, role: 'PLAYER' | 'SUBSTITUTE', createdAt: string): RosterParticipant {
  return { id, userId: id, role, createdAt }
}

describe('computeMatchCapacity', () => {
  it('uses explicit max players when teams are disabled', () => {
    expect(computeMatchCapacity({ team_count: 0, team_size: 5, max_players: 12 })).toBe(12)
  })

  it('derives capacity from teams when teams are enabled', () => {
    expect(computeMatchCapacity({ team_count: 3, team_size: 6, max_players: 99 })).toBe(18)
  })
})

describe('computeRosterPolicy', () => {
  it('allows new players before the official list is full and no substitutes are waiting', () => {
    const policy = computeRosterPolicy(5, [
      participant(1, 'PLAYER', '2026-01-01T10:00:00Z'),
      participant(2, 'PLAYER', '2026-01-01T10:01:00Z'),
    ])

    expect(policy.freeSlots).toBe(3)
    expect(policy.eligibleSubstituteIds).toEqual([])
    expect(policy.canNewPlayerJoin).toBe(true)
  })

  it('reserves scarce free slots for FIFO substitutes', () => {
    const policy = computeRosterPolicy(10, [
      ...Array.from({ length: 8 }, (_, i) => participant(i + 1, 'PLAYER', `2026-01-01T10:0${i}:00Z`)),
      participant(20, 'SUBSTITUTE', '2026-01-01T11:00:00Z'),
      participant(21, 'SUBSTITUTE', '2026-01-01T11:01:00Z'),
      participant(22, 'SUBSTITUTE', '2026-01-01T11:02:00Z'),
    ])

    expect(policy.freeSlots).toBe(2)
    expect(policy.reservedSlots).toBe(2)
    expect(policy.eligibleSubstituteIds).toEqual([20, 21])
    expect(policy.canNewPlayerJoin).toBe(false)
  })

  it('returns to open joining when there are more free slots than substitutes', () => {
    const policy = computeRosterPolicy(10, [
      participant(1, 'PLAYER', '2026-01-01T10:00:00Z'),
      participant(2, 'PLAYER', '2026-01-01T10:01:00Z'),
      participant(20, 'SUBSTITUTE', '2026-01-01T11:00:00Z'),
      participant(21, 'SUBSTITUTE', '2026-01-01T11:01:00Z'),
    ])

    expect(policy.freeSlots).toBe(8)
    expect(policy.eligibleSubstituteIds).toEqual([20, 21])
    expect(policy.canNewPlayerJoin).toBe(true)
  })

  it('uses participant id as a stable FIFO tie breaker', () => {
    const policy = computeRosterPolicy(2, [
      participant(1, 'PLAYER', '2026-01-01T10:00:00Z'),
      participant(30, 'SUBSTITUTE', '2026-01-01T11:00:00Z'),
      participant(20, 'SUBSTITUTE', '2026-01-01T11:00:00Z'),
    ])

    expect(policy.eligibleSubstituteIds).toEqual([20])
  })
})
