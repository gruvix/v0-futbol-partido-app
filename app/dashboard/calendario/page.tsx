import { sql } from '@/lib/db'
import { CalendarView } from '@/components/calendar-view'

interface MatchSummary {
  id: number
  date_time: string
  location_type: string
  location_custom: string | null
  participant_count: number
}

async function getMatchesForCalendar(): Promise<MatchSummary[]> {
  const matches = await sql`
    SELECT 
      m.id,
      m.date_time,
      m.location_type,
      m.location_custom,
      COUNT(mp.id)::int as participant_count
    FROM matches m
    LEFT JOIN match_participants mp ON m.id = mp.match_id
    WHERE m.date_time >= NOW() - INTERVAL '30 days'
    GROUP BY m.id
    ORDER BY m.date_time ASC
  `
  return matches as MatchSummary[]
}

export default async function CalendarioPage() {
  const matches = await getMatchesForCalendar()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
        <p className="text-muted-foreground">Mira todos los partidos programados</p>
      </div>

      <CalendarView matches={matches} />
    </div>
  )
}
