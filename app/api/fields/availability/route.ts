import { NextResponse } from 'next/server'
import { fetchAllComplexesAvailability, parseRequestedDate } from '@/lib/fields/availability'

export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date') || searchParams.get('dia') || searchParams.get('d')
  const date = parseRequestedDate(dateParam)

  try {
    const data = await fetchAllComplexesAvailability(date)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch fields availability', (error as Error).message)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 502 })
  }
}
