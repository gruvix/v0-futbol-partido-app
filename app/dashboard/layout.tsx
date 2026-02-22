import React from "react"
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard-nav'
import { ActionLoaderWrapper } from '@/components/action-loader-provider'
import { RouteLoader } from '@/components/route-loader'
import { ErrorToastProvider } from '@/components/error-toast-provider'
import { initializeDatabase } from '@/lib/db'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize database on first load
  try {
    await initializeDatabase()
  } catch (e) {
    console.error('DB init error:', e)
  }

  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <ActionLoaderWrapper>
      <ErrorToastProvider>
        <div className="min-h-screen bg-white/40">
          <RouteLoader />
          <DashboardNav
            userName={session.lastName ? `${session.name} ${session.lastName}` : session.name}
            isAdmin={Boolean(session.admin)}
          />
          <main className="container mx-auto px-4 py-6 max-w-4xl">
            {children}
          </main>
        </div>
      </ErrorToastProvider>
    </ActionLoaderWrapper>
  )
}
