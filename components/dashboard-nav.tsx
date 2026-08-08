'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/app/actions/auth'
import {
  Calendar,
  Users,
  Plus,
  LogOut,
  Home,
  BarChart3,
  Settings,
  Menu,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingOverlay } from '@/components/football-loader'

interface DashboardNavProps {
  userName: string
  isAdmin: boolean
}

export function DashboardNav({ userName, isAdmin }: DashboardNavProps) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Partidos', icon: Home },
    { href: '/dashboard/calendario', label: 'Calendario', icon: Calendar },
    { href: '/dashboard/jugadores', label: 'Jugadores', icon: Users },
    { href: '/dashboard/configuracion', label: 'Config', icon: Settings },
    ...(isAdmin ? [{ href: '/dashboard/stats', label: 'Stats', icon: BarChart3 }] : []),
  ]

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between h-14 gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-lg text-foreground">BariFutbol</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} prefetch={true}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('gap-2', isActive && 'bg-green-300 text-secondary-foreground')}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/dashboard/invitar" prefetch={true}>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    'gap-2 bg-transparent',
                    pathname === '/dashboard/invitar' && 'bg-green-300 text-secondary-foreground',
                  )}
                >
                  <UserPlus className="w-4 h-4" />
                  Invitar usuario
                </Button>
              </Link>
              <Link href="/dashboard/nuevo" prefetch={true}>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nuevo partido
                </Button>
              </Link>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="sm:hidden gap-2 bg-transparent h-11 w-11 px-0">
                  <Menu className="w-7 h-7" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(95vw,24rem)] p-2 text-xl [&_[data-slot=dropdown-menu-item]]:py-3 [&_[data-slot=dropdown-menu-item]]:px-3.5 [&_[data-slot=dropdown-menu-item]]:text-xl [&_[data-slot=dropdown-menu-item]]:gap-3.5 [&_[data-slot=dropdown-menu-separator]]:my-2"
              >
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        prefetch={true}
                        className={cn('gap-3.5 cursor-pointer', isActive && 'bg-accent')}
                      >
                        <Icon className="w-7 h-7" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/nuevo" prefetch={true} className="gap-3.5 cursor-pointer">
                    <Plus className="w-7 h-7" />
                    Nuevo partido
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/invitar" prefetch={true} className="gap-3.5 cursor-pointer">
                    <UserPlus className="w-7 h-7" />
                    Invitar usuario
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
      </div>
    </header>
  )
}
