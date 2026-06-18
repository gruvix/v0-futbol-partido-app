import { describe, expect, it } from 'vitest'

import { fetchTerrazasAvailability } from './terrazas'

describe('fetchTerrazasAvailability', () => {
  it('rejects invalid dates before fetching availability', async () => {
    await expect(fetchTerrazasAvailability('not-a-date')).rejects.toThrow('Invalid date')
  })
})
