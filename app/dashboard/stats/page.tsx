import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUsersWithStats, saveUserStats } from '@/app/actions/stats'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

      <div className="grid gap-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-2">
              <p className="font-medium text-foreground">
                {user.name} <span className="text-muted-foreground text-sm">({user.phone_last_four})</span>
              </p>
            </CardHeader>
            <CardContent>
              <form action={saveUserStats} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-end">
                <input type="hidden" name="userId" value={String(user.id)} />
                <Input type="number" min={0} max={10} name="pac" defaultValue={String(user.pac)} aria-label="Pace" placeholder="PAC" />
                <Input type="number" min={0} max={10} name="sho" defaultValue={String(user.sho)} aria-label="Shooting" placeholder="SHO" />
                <Input type="number" min={0} max={10} name="pas" defaultValue={String(user.pas)} aria-label="Passing" placeholder="PAS" />
                <Input type="number" min={0} max={10} name="dri" defaultValue={String(user.dri)} aria-label="Dribbling" placeholder="DRI" />
                <Input type="number" min={0} max={10} name="def" defaultValue={String(user.def)} aria-label="Defending" placeholder="DEF" />
                <Input type="number" min={0} max={10} name="phy" defaultValue={String(user.phy)} aria-label="Physicality" placeholder="PHY" />
                <Button type="submit" size="sm">Guardar</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
