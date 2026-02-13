import { CalendarView } from '@/components/calendar-view'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

interface MatchSummary {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  participant_count: number
}

async function getMatchesForCalendarMonth(year: number, month: number): Promise<MatchSummary[]> {
  // Initial render for current month; other months are fetched client-side.
  // On the server, avoid calling our own API route via HTTP (which can break in prod if it
  // accidentally points at localhost). Query the DB directly.

  const session = await getSession()
  if (!session) return []

  // month is 0-based in the UI.
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0))

  // Calendar includes past matches, but still enforces privacy:
  // - public matches are visible to everyone
  // - private matches only visible to participants
  const matches = await sql`
    SELECT
      m.id,
      m.title,
      m.date_time,
      m.location_type,
      m.location_custom,
      COUNT(mp_all.id)::int as participant_count
    FROM matches m
    LEFT JOIN match_participants mp_all ON m.id = mp_all.match_id
    WHERE
      m.date_time >= ${start.toISOString()} AND m.date_time < ${end.toISOString()}
      AND (
        m.is_public = true
        OR EXISTS (
          SELECT 1
          FROM match_participants mp_me
          WHERE mp_me.match_id = m.id AND mp_me.user_id = ${session.userId}
        )
      )
    GROUP BY m.id
    ORDER BY m.date_time ASC
  `

  return matches as MatchSummary[]
}

export default async function CalendarioPage() {
  const today = new Date()
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()

  // IMPORTANT: We pass initial matches for the current month only.
  // CalendarView will request other months as the user navigates.
  // NOTE: Server-side fetch via the API route needs auth cookies; if it fails,
  // CalendarView will still be able to fetch on the client.
  const matches = await getMatchesForCalendarMonth(year, month)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
        <p className="text-muted-foreground">Mira todos los partidos programados</p>
      </div>

      <CalendarView initialMatches={matches} initialYear={year} initialMonth={month} />
    </div>
  )
}
