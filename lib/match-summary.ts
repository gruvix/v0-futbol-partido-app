export interface MatchCountsSummary {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  player_count: number
  substitute_count: number
}

export function getParticipantCountsFromRoster(participants: ReadonlyArray<{ role: 'PLAYER' | 'SUBSTITUTE' }>): {
  playerCount: number
  substituteCount: number
} {
  let playerCount = 0
  let substituteCount = 0

  for (const p of participants) {
    if (p.role === 'PLAYER') playerCount += 1
    else substituteCount += 1
  }

  return { playerCount, substituteCount }
}
