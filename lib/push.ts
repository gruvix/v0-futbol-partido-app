import { sql } from '@/lib/db'
import webpush from 'web-push'

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }

const MAX_PARTICIPANTS_IN_PUSH_BODY = 6

export function getPushErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

export function shouldSendPushNotifications(): boolean {
  return process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'main'
}

export async function sendPushToSubscriptions(subscriptions: PushSubscriptionRow[], payload: { title: string; body: string; url?: string }) {
  if (!shouldSendPushNotifications()) return

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublicKey || !vapidPrivateKey || subscriptions.length === 0) return

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@example.com', vapidPublicKey, vapidPrivateKey)

  const serialized = JSON.stringify(payload)
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          serialized
        )
      } catch (error: unknown) {
        const statusCode = getPushErrorStatusCode(error)
        if (statusCode === 404 || statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`
        }
      }
    })
  )
}

export function buildParticipantNamesSummary(names: string[]): string {
  if (names.length <= MAX_PARTICIPANTS_IN_PUSH_BODY) return names.join(', ')
  return `${names.slice(0, MAX_PARTICIPANTS_IN_PUSH_BODY).join(', ')} +${names.length - MAX_PARTICIPANTS_IN_PUSH_BODY} más`
}

export async function sendMatchFilledPushIfNeeded(matchId: number): Promise<void> {
  const matchRows = await sql`
    SELECT
      title,
      CASE WHEN team_count > 0 THEN GREATEST(1, team_count) * GREATEST(1, team_size) ELSE max_players END AS max_players
    FROM matches
    WHERE id = ${matchId}
  `
  const match = matchRows[0]
  if (!match) return

  const maxPlayers = Number(match.max_players || 0)
  if (maxPlayers <= 0) return

  const players = await sql`
    SELECT COALESCE(trim(initcap(u.name) || ' ' || initcap(u.last_name)), mp.guest_name, 'Invitado') AS name
    FROM match_participants mp
    LEFT JOIN users u ON u.id = mp.user_id
    WHERE mp.match_id = ${matchId} AND mp.role = 'PLAYER'
    ORDER BY mp.id ASC
  `
  if (players.length !== maxPlayers) return

  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND pns.match_filled = true
  `

  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Partido lleno',
    body: `${String(match.title || 'El partido')} ya está completo. Jugadores: ${buildParticipantNamesSummary(players.map((p) => String(p.name)))}`,
    url: `/dashboard/partido/${matchId}`,
  })
}

export async function sendMatchChangesPush(matchId: number): Promise<void> {
  const matchRows = await sql`SELECT title FROM matches WHERE id = ${matchId}`
  const title = String(matchRows[0]?.title || 'Partido')
  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND pns.match_changes = true
  `
  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Cambios en el partido',
    body: `${title} tuvo cambios de horario, lugar o datos del partido`,
    url: `/dashboard/partido/${matchId}`,
  })
}

export async function sendEligibleSubstitutesPush(matchId: number, participantIds: number[]): Promise<void> {
  if (participantIds.length === 0) return

  const matchRows = await sql`SELECT title FROM matches WHERE id = ${matchId}`
  const matchTitle = String(matchRows[0]?.title || 'Partido')

  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.id = ANY(${participantIds}::int[])
      AND mp.user_id IS NOT NULL
      AND mp.role = 'SUBSTITUTE'
  `

  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Te toca confirmar',
    body: `Hay un cupo libre en ${matchTitle}. Confirmá si querés pasar a jugador.`,
    url: `/dashboard/partido/${matchId}`,
  })
}

export async function sendNewMatchPush(matchId: number, matchTitle: string, creatorUserId: number): Promise<void> {
  // Notify all users who have new_match enabled, EXCEPT the creator
  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM push_notifications_settings pns
    JOIN push_subscriptions ps ON ps.user_id = pns.user_id
    WHERE pns.new_match = true
      AND pns.user_id <> ${creatorUserId}
  `
  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Nuevo partido creado',
    body: matchTitle,
    url: `/dashboard/partido/${matchId}`,
  })
}

export async function sendMatchCancelledPush(matchId: number, matchTitle: string, deletingUserId: number): Promise<void> {
  // Notify all participants of the match (except the one deleting) who have match_cancelled enabled
  // Must be called BEFORE the match/participants are deleted from the DB
  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND mp.user_id <> ${deletingUserId}
      AND pns.match_cancelled = true
  `
  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Partido cancelado',
    body: `${matchTitle} fue cancelado`,
    url: '/dashboard',
  })
}

export async function sendPlayerLeftPush(matchId: number, leavingUserId: number): Promise<void> {
  // Notify other participants who have cancellation (player unsubscribe) enabled
  const matchRows = await sql`SELECT title FROM matches WHERE id = ${matchId}`
  const matchTitle = String(matchRows[0]?.title || 'Partido')

  const userRows = await sql`SELECT trim(initcap(name) || ' ' || initcap(last_name)) as full_name FROM users WHERE id = ${leavingUserId}`
  const playerName = String(userRows[0]?.full_name || 'Un jugador')

  const subscriptions = await sql`
    SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
    FROM match_participants mp
    JOIN push_notifications_settings pns ON pns.user_id = mp.user_id
    JOIN push_subscriptions ps ON ps.user_id = mp.user_id
    WHERE mp.match_id = ${matchId}
      AND mp.user_id IS NOT NULL
      AND mp.user_id <> ${leavingUserId}
      AND pns.cancellation = true
  `
  await sendPushToSubscriptions(subscriptions as PushSubscriptionRow[], {
    title: 'Baja de jugador',
    body: `${playerName} se bajó de ${matchTitle}`,
    url: `/dashboard/partido/${matchId}`,
  })
}
