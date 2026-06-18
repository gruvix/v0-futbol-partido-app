export type ParticipantRole = 'PLAYER' | 'SUBSTITUTE'

export interface RosterParticipant {
  id: number
  userId: number | null
  role: ParticipantRole
  createdAt: string | Date
}

export interface RosterPolicy {
  maxPlayers: number
  playerCount: number
  substituteCount: number
  freeSlots: number
  reservedSlots: number
  eligibleSubstituteIds: number[]
  canNewPlayerJoin: boolean
}

export function computeMatchCapacity(match: {
  team_count: number
  team_size: number
  max_players: number
}): number {
  const teamCount = Number(match.team_count || 0)
  if (teamCount > 0) {
    return Math.max(1, teamCount) * Math.max(1, Number(match.team_size || 0))
  }
  return Math.max(0, Number(match.max_players || 0))
}

function createdAtTime(value: string | Date): number {
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function computeRosterPolicy(maxPlayers: number, participants: RosterParticipant[]): RosterPolicy {
  const players = participants.filter((p) => p.role === 'PLAYER')
  const substitutes = participants
    .filter((p) => p.role === 'SUBSTITUTE')
    .sort((a, b) => {
      const byTime = createdAtTime(a.createdAt) - createdAtTime(b.createdAt)
      return byTime !== 0 ? byTime : a.id - b.id
    })

  const normalizedMaxPlayers = Math.max(0, Number(maxPlayers || 0))
  const freeSlots = normalizedMaxPlayers <= 0
    ? Number.POSITIVE_INFINITY
    : Math.max(0, normalizedMaxPlayers - players.length)
  const eligibleCount = Number.isFinite(freeSlots)
    ? Math.min(freeSlots, substitutes.length)
    : substitutes.length

  return {
    maxPlayers: normalizedMaxPlayers,
    playerCount: players.length,
    substituteCount: substitutes.length,
    freeSlots,
    reservedSlots: eligibleCount,
    eligibleSubstituteIds: substitutes.slice(0, eligibleCount).map((p) => p.id),
    canNewPlayerJoin: normalizedMaxPlayers <= 0 || freeSlots > substitutes.length,
  }
}

export function isEligibleSubstitute(policy: RosterPolicy, participantId: number): boolean {
  return policy.eligibleSubstituteIds.includes(participantId)
}
