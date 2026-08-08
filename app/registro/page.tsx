import { isInviteOnlyRegistration } from '@/lib/auth'
import { RegistroForm } from './registro-form'

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const inviteOnly = isInviteOnlyRegistration()
  const { token } = await searchParams

  return <RegistroForm inviteOnly={inviteOnly} inviteToken={token ?? ''} />
}
