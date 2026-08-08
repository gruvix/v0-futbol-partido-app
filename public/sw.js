// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  const defaultData = { title: 'BariFutbol', body: 'Tenés una nueva notificación' }

  let data = defaultData
  try {
    if (event.data) {
      data = { ...defaultData, ...event.data.json() }
    }
  } catch {
    // If JSON parsing fails, try text
    if (event.data) {
      data = { ...defaultData, body: event.data.text() }
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/web-app-manifest-192x192.png',
      data: data.url ? { url: data.url } : undefined,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
