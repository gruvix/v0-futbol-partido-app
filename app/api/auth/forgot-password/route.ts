import { NextResponse } from 'next/server'

import { requestPasswordReset } from '@/lib/auth'
import { EmailSendError } from '@/lib/email-errors'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const email = typeof (body as { email?: unknown })?.email === 'string'
    ? (body as { email: string }).email.trim()
    : ''

  if (!email) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  try {
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
