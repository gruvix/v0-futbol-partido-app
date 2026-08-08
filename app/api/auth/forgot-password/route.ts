import { NextResponse } from 'next/server'

import { requestPasswordReset } from '@/lib/auth'
import { EmailSendError } from '@/lib/email-errors'
import { getClientIp, isRateLimited } from '@/lib/rate-limit'

const IP_LIMIT = 10
const IP_WINDOW_SECONDS = 15 * 60
const EMAIL_LIMIT = 3
const EMAIL_WINDOW_SECONDS = 60 * 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const email = typeof (body as { email?: unknown })?.email === 'string'
    ? (body as { email: string }).email.trim().toLowerCase()
    : ''

  if (!email) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const clientIp = getClientIp(request)

  try {
    const ipLimited = await isRateLimited('forgot-password:ip', clientIp, IP_LIMIT, IP_WINDOW_SECONDS)
    if (ipLimited) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const emailLimited = await isRateLimited('forgot-password:email', email, EMAIL_LIMIT, EMAIL_WINDOW_SECONDS)
    if (emailLimited) {
      // Same generic success to avoid leaking whether the email exists.
      return NextResponse.json({ success: true })
    }

    await requestPasswordReset(email)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof EmailSendError) {
      console.error('[password-reset] Email send failed')
      return NextResponse.json({ error: 'send_failed' }, { status: 500 })
    }
    console.error('[password-reset] Unexpected error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
