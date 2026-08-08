import { ensureRateLimitSchema, sql } from './db'

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Returns true when the action should be blocked (limit exceeded).
 */
export async function isRateLimited(
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  await ensureRateLimitSchema()

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM rate_limit_events
    WHERE bucket = ${bucket}
      AND bucket_key = ${key}
      AND created_at > ${since}
  `

  const count = Number(rows[0]?.count ?? 0)
  if (count >= limit) return true

  await sql`
    INSERT INTO rate_limit_events (bucket, bucket_key)
    VALUES (${bucket}, ${key})
  `

  return false
}
