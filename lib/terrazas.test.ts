import { describe, it, expect } from 'vitest'
import { fetchTerrazasAvailability } from './terrazas'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests mock fetch to avoid external calls.

describe('fetchTerrazasAvailability', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('throws on invalid date', async () => {
    await expect(fetchTerrazasAvailability('invalid-date')).rejects.toThrow('Invalid date')
  })

  it('parses slots from __NEXT_DATA__ payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
            props: {
              pageProps: {
                bloques: [
                  { hora: '19:00', disponible: true, precio: 100 },
                  { hora: '20:30', disponible: false },
                ],
              },
            },
          })}</script></html>`
        ),
    } as any)

    const slots = await fetchTerrazasAvailability('2026-02-03')
    expect(slots).toEqual([
      { time: '19:00', available: true },
      { time: '20:30', available: false },
    ])
  })

  it('falls back to HTML regex parsing when __NEXT_DATA__ missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<div>Horario 21:15 disponible</div><div>Horario 22:45 no disponible</div>`
        ),
    } as any)

    const slots = await fetchTerrazasAvailability('2026-02-03')
    expect(slots).toEqual([
      { time: '21:15', available: true },
      { time: '22:45', available: false },
    ])
  })
})
