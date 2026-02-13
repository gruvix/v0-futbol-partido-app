import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUsersWithStats } from '@/app/actions/stats'
import { StatsUserCard } from '@/components/stats-user-card'

export default async function StatsPage() {
  const session = await getSession()
  if (!session?.admin) {
    redirect('/dashboard')
  }

  const { users } = await getUsersWithStats()
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stats</h1>
        <p className="text-muted-foreground">Editar habilidades (0 a 10)</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => (
          <StatsUserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  )
}
