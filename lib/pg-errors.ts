export function isPgAlreadyExistsError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string }
    if (e.code === '42P07' || e.code === '42710') return true
    if (e.message?.toLowerCase().includes('already exists')) return true
  }
  return false
}
