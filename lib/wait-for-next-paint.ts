export function waitForNextPaint(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, 80)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.clearTimeout(timeoutId)
        resolve()
      })
    })
  })
}
