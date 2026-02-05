'use client'

import { ActionLoaderProvider } from '@/components/football-loader'

export function ActionLoaderWrapper({ children }: { children: React.ReactNode }) {
  return <ActionLoaderProvider>{children}</ActionLoaderProvider>
}
