import { initializeDatabase } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await initializeDatabase()
    return NextResponse.json({ success: true, message: 'Base de datos inicializada' })
  } catch (error) {
    console.error('Error initializing database:', error)
    return NextResponse.json(
      { success: false, error: 'Error al inicializar la base de datos' },
      { status: 500 }
    )
  }
}
