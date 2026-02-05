'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions/auth'
import { Calendar, Users, Plus, LogOut, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingOverlay } from '@/components/football-loader'

interface DashboardNavProps {
  userName: string
}

export function DashboardNav({ userName }: DashboardNavProps) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Partidos', icon: Home },
    { href: '/dashboard/calendario', label: 'Calendario', icon: Calendar },
    { href: '/dashboard/jugadores', label: 'Jugadores', icon: Users },
  ]

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-lg text-foreground">Fulbito</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} prefetch={true}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      isActive && 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/nuevo" prefetch={true}>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo partido</span>
              </Button>
            </Link>
            
            {loggingOut && <LoadingOverlay message="Cerrando sesion..." />}
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2" 
              title={`Salir (${userName})`}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Salir</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex sm:hidden items-center gap-1 pb-2 -mx-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} prefetch={true}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2 text-xs',
                    isActive && 'bg-secondary text-secondary-foreground'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
