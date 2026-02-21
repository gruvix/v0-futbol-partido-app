import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { MatchCountsSummary } from '@/lib/match-summary'

function parseIntParam(value: string | null): number | null {
  if (!value) return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = parseIntParam(searchParams.get('year'))
  const month = parseIntParam(searchParams.get('month'))

  if (year === null || month === null || month < 0 || month > 11) {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 })
  }

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
      COUNT(mp_all.id) FILTER (
        WHERE (CASE WHEN mp_all.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp_all.role::text END) = 'PLAYER'
      )::int as player_count,
      COUNT(mp_all.id) FILTER (
        WHERE (CASE WHEN mp_all.role = 'EXTRA' THEN 'SUBSTITUTE' ELSE mp_all.role::text END) = 'SUBSTITUTE'
      )::int as substitute_count
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

  return NextResponse.json({ matches: matches as MatchCountsSummary[] })
}
