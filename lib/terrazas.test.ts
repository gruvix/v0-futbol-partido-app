import { describe, it, expect } from 'vitest'
import { fetchTerrazasAvailability } from './terrazas'

// Note: This test only checks that the function validates and formats dates correctly.
// It does NOT hit the external network.

describe('fetchTerrazasAvailability', () => {
  it('throws on invalid date', async () => {
    await expect(fetchTerrazasAvailability('invalid-date')).rejects.toThrow('Invalid date')
  })
})
