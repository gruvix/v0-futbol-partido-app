import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export default async function LoginPage(): Promise<React.JSX.Element> {
  const session = await getSession()

  // If already authenticated, do not allow accessing /login
  if (session) {
    redirect('/dashboard')
  }

  return <LoginForm />
}
