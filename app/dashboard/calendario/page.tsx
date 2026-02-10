import { CalendarView } from '@/components/calendar-view'
import { cookies } from 'next/headers'

interface MatchSummary {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  participant_count: number
}

async function getMatchesForCalendarMonth(year: number, month: number): Promise<MatchSummary[]> {
  // Initial render fetch for current month; subsequent month changes are fetched client-side.
  // IMPORTANT: forward cookies, otherwise the API route returns 401 and you'll see an empty initial month.
  const cookieHeader = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')

  // In Next.js server components, fetch() requires an absolute URL.
  // Prefer explicit NEXT_PUBLIC_APP_URL, otherwise fall back to localhost.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const res = await fetch(`${origin}/api/matches/calendar?year=${year}&month=${month}`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })

  if (!res.ok) {
    return []
  }

  const data = (await res.json()) as { matches: MatchSummary[] }
  return data.matches
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
