declare module 'web-push' {
  export interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  export interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(subscription: PushSubscription, payload?: string): Promise<void>
  }

  const webpush: WebPush
  export default webpush
}
