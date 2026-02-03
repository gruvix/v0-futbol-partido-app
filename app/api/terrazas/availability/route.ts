import { NextResponse } from 'next/server'
import { fetchTerrazasAvailability } from '@/lib/terrazas'

export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('dia') || searchParams.get('date') || searchParams.get('d')

  if (!date) {
    return NextResponse.json({ error: 'Missing date (dia)' }, { status: 400 })
  }

  try {
    const slots = await fetchTerrazasAvailability(date)
    return NextResponse.json({ date, slots })
  } catch (error) {
    console.error('Failed to fetch Terrazas availability', (error as Error).message)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 502 })
  }
}
