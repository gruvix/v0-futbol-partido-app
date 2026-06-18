import { describe, it, expect, vi, beforeEach } from 'vitest'

const _sqlState = vi.hoisted(() => ({
  results: {} as Record<string, unknown[]>,
  calls: [] as Array<{ query: string; values: unknown[] }>,
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/lib/db', () => {
  return {
    sql: function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
      const query = strings.join('?')
      _sqlState.calls.push({ query, values })
      for (const [key, result] of Object.entries(_sqlState.results)) {
        if (query.includes(key)) {
          return Promise.resolve(result)
        }
      }
      return Promise.resolve([])
    },
  }
})

import {
  buildParticipantNamesSummary,
  getPushErrorStatusCode,
  sendPushToSubscriptions,
  sendNewMatchPush,
  sendMatchCancelledPush,
  sendPlayerLeftPush,
  sendMatchFilledPushIfNeeded,
  sendMatchChangesPush,
  sendEligibleSubstitutesPush,
} from './push'

function resetState() {
  _sqlState.calls.length = 0
  for (const key of Object.keys(_sqlState.results)) {
    delete _sqlState.results[key]
  }
}

describe('getPushErrorStatusCode', () => {
  it('returns null for null/undefined/non-object', () => {
    expect(getPushErrorStatusCode(null)).toBeNull()
    expect(getPushErrorStatusCode(undefined)).toBeNull()
    expect(getPushErrorStatusCode('string')).toBeNull()
    expect(getPushErrorStatusCode(42)).toBeNull()
  })

  it('returns null if no statusCode property', () => {
    expect(getPushErrorStatusCode({ message: 'error' })).toBeNull()
  })

  it('returns statusCode when it is a number', () => {
    expect(getPushErrorStatusCode({ statusCode: 404 })).toBe(404)
    expect(getPushErrorStatusCode({ statusCode: 410 })).toBe(410)
    expect(getPushErrorStatusCode({ statusCode: 201 })).toBe(201)
  })

  it('returns null when statusCode is not a number', () => {
    expect(getPushErrorStatusCode({ statusCode: '404' })).toBeNull()
    expect(getPushErrorStatusCode({ statusCode: null })).toBeNull()
  })
})

describe('buildParticipantNamesSummary', () => {
  it('joins names with comma for 6 or fewer', () => {
    expect(buildParticipantNamesSummary(['Alice', 'Bob'])).toBe('Alice, Bob')
    expect(buildParticipantNamesSummary(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C, D, E, F')
  })

  it('shows first 6 and count for more than 6', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    expect(buildParticipantNamesSummary(names)).toBe('A, B, C, D, E, F +1 más')
  })

  it('shows first 6 and count for 10 names', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    expect(buildParticipantNamesSummary(names)).toBe('A, B, C, D, E, F +4 más')
  })

  it('returns empty string for empty array', () => {
    expect(buildParticipantNamesSummary([])).toBe('')
  })
})

describe('sendPushToSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  it('does nothing without VAPID keys', async () => {
    const oldPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const oldPrivate = process.env.VAPID_PRIVATE_KEY
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY

    const webpush = (await import('web-push')).default
    await sendPushToSubscriptions(
      [{ endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' }],
      { title: 'Test', body: 'Test body' }
    )
    expect(webpush.sendNotification).not.toHaveBeenCalled()

    if (oldPublic) process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = oldPublic
    if (oldPrivate) process.env.VAPID_PRIVATE_KEY = oldPrivate
  })

  it('does nothing with empty subscriptions array', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
    const webpush = (await import('web-push')).default
    await sendPushToSubscriptions([], { title: 'Test', body: 'Test body' })
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('sends notification to each subscription', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
    const webpush = (await import('web-push')).default

    const subs = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push.example.com/sub2', p256dh: 'key2', auth: 'auth2' },
    ]
    await sendPushToSubscriptions(subs, { title: 'Test', body: 'Hello' })

    expect(webpush.setVapidDetails).toHaveBeenCalled()
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/sub1', keys: { p256dh: 'key1', auth: 'auth1' } },
      JSON.stringify({ title: 'Test', body: 'Hello' })
    )
  })

  it('removes stale subscription on 410 error', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
    const webpush = (await import('web-push')).default
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 })

    await sendPushToSubscriptions(
      [{ endpoint: 'https://push.example.com/stale', p256dh: 'k', auth: 'a' }],
      { title: 'Test', body: 'body' }
    )

    const deleteCall = _sqlState.calls.find(c => c.query.includes('DELETE FROM push_subscriptions'))
    expect(deleteCall).toBeDefined()
    expect(deleteCall!.values).toContain('https://push.example.com/stale')
  })
})

describe('sendNewMatchPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('queries users with new_match enabled excluding creator and sends push', async () => {
    _sqlState.results['new_match = true'] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]
    const webpush = (await import('web-push')).default
    await sendNewMatchPush(1, 'Partido de Juan', 42)

    const call = _sqlState.calls.find(c => c.query.includes('new_match = true'))
    expect(call).toBeDefined()
    expect(call!.values).toContain(42)
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Nuevo partido creado')
    expect(payload.body).toBe('Partido de Juan')
  })
})

describe('sendMatchCancelledPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('sends cancelled notification to participants excluding deleter', async () => {
    _sqlState.results['match_cancelled = true'] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]
    const webpush = (await import('web-push')).default
    await sendMatchCancelledPush(5, 'Partido de Pedro', 10)

    const call = _sqlState.calls.find(c => c.query.includes('match_cancelled = true'))
    expect(call).toBeDefined()
    expect(call!.values).toContain(5)
    expect(call!.values).toContain(10)
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Partido cancelado')
    expect(payload.body).toContain('Partido de Pedro')
  })
})

describe('sendPlayerLeftPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('sends player left notification to other participants', async () => {
    _sqlState.results['FROM matches WHERE id'] = [{ title: 'Partido de Ana' }]
    _sqlState.results['FROM users WHERE id'] = [{ full_name: 'Carlos López' }]
    _sqlState.results['cancellation = true'] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]

    const webpush = (await import('web-push')).default
    await sendPlayerLeftPush(7, 20)

    const matchCall = _sqlState.calls.find(c => c.query.includes('FROM matches WHERE id'))
    expect(matchCall).toBeDefined()
    expect(matchCall!.values).toContain(7)

    const userCall = _sqlState.calls.find(c => c.query.includes('FROM users WHERE id'))
    expect(userCall).toBeDefined()
    expect(userCall!.values).toContain(20)

    const subCall = _sqlState.calls.find(c => c.query.includes('cancellation = true'))
    expect(subCall).toBeDefined()

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Baja de jugador')
    expect(payload.body).toContain('Carlos López')
    expect(payload.body).toContain('Partido de Ana')
  })
})

describe('sendMatchFilledPushIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('does not send when match is not full', async () => {
    _sqlState.results['FROM matches'] = [{ title: 'Test', max_players: 10 }]
    _sqlState.results["role = 'PLAYER'"] = [
      { name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' },
    ]

    const webpush = (await import('web-push')).default
    await sendMatchFilledPushIfNeeded(1)
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('sends notification with player names when match is full', async () => {
    _sqlState.results['FROM matches'] = [{ title: 'Test Match', max_players: 2 }]
    _sqlState.results["role = 'PLAYER'"] = [{ name: 'Alice' }, { name: 'Bob' }]
    _sqlState.results['match_filled = true'] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]

    const webpush = (await import('web-push')).default
    await sendMatchFilledPushIfNeeded(1)

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Partido lleno')
    expect(payload.body).toContain('Alice')
    expect(payload.body).toContain('Bob')
  })
})

describe('sendMatchChangesPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('sends change notification to participants', async () => {
    _sqlState.results['FROM matches WHERE id'] = [{ title: 'Partido de Test' }]
    _sqlState.results['match_changes = true'] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]

    const webpush = (await import('web-push')).default
    await sendMatchChangesPush(3)

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Cambios en el partido')
    expect(payload.body).toContain('Partido de Test')
  })
})

describe('sendEligibleSubstitutesPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public'
    process.env.VAPID_PRIVATE_KEY = 'test-private'
  })

  it('sends confirmation notification directly to eligible substitute subscriptions', async () => {
    _sqlState.results['FROM matches WHERE id'] = [{ title: 'Partido FIFO' }]
    _sqlState.results["mp.role = 'SUBSTITUTE'"] = [
      { endpoint: 'https://push.example.com/sub1', p256dh: 'k1', auth: 'a1' },
    ]

    const webpush = (await import('web-push')).default
    await sendEligibleSubstitutesPush(9, [20, 21])

    const subCall = _sqlState.calls.find(c => c.query.includes("mp.role = 'SUBSTITUTE'"))
    expect(subCall).toBeDefined()
    expect(subCall!.values).toContain(9)
    expect(subCall!.values).toContainEqual([20, 21])
    expect(subCall!.query).not.toContain('push_notifications_settings')

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(payload.title).toBe('Te toca confirmar')
    expect(payload.body).toContain('Partido FIFO')
    expect(payload.url).toBe('/dashboard/partido/9')
  })

  it('does nothing with no eligible participant ids', async () => {
    const webpush = (await import('web-push')).default
    await sendEligibleSubstitutesPush(9, [])

    expect(_sqlState.calls).toHaveLength(0)
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })
})
