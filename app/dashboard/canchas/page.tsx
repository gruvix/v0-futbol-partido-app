import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { listFields } from '@/lib/fields'
import { FieldsAdminClient } from './fields-admin-client'

export default async function CanchasPage() {
  const session = await getSession()
  if (!session?.admin) {
    redirect('/dashboard')
  }

  const fields = await listFields(true)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canchas</h1>
        <p className="text-muted-foreground">
          Gestioná predios, políticas de cancelación y enlaces a mapas.
        </p>
      </div>
      <FieldsAdminClient initialFields={fields} />
    </div>
  )
}
