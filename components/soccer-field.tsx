'use client'

import { useMemo } from 'react'
import { PixelAvatar } from '@/components/pixel-avatar'

interface FieldParticipant {
  id: number
  name: string
  pixel_avatar?: string | null
  role: 'PLAYER' | 'SUBSTITUTE'
}

interface SoccerFieldProps {
  participants: FieldParticipant[]
  maxPlayers: number
}

/**
 * Pre-defined positions (as % of field width/height) for up to 22 players.
 * Positions are arranged in a classic soccer formation layout.
 */
const FIELD_POSITIONS: [number, number][] = [
  // Row 1 - GK
  [50, 90],
  // Row 2 - Defense
  [20, 74], [40, 70], [60, 70], [80, 74],
  // Row 3 - Midfield
  [15, 52], [38, 48], [62, 48], [85, 52],
  // Row 4 - Attack
  [30, 28], [50, 24], [70, 28],
  // Second team / extra positions (mirrored)
  [50, 10],
  [20, 26], [40, 30], [60, 30], [80, 26],
  [15, 48], [38, 52], [62, 52], [85, 48],
  [30, 72],
]

export function SoccerField({ participants, maxPlayers }: SoccerFieldProps) {
  const players = useMemo(
    () => participants.filter((p) => p.role === 'PLAYER').slice(0, Math.min(maxPlayers, FIELD_POSITIONS.length)),
    [participants, maxPlayers],
  )

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border" style={{ aspectRatio: '3 / 4' }}>
      {/* Field background */}
      <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Grass */}
        <rect width="300" height="400" fill="#2d8a4e" />
        {/* Stripes */}
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="0" y={i * 50} width="300" height="50" fill={i % 2 === 0 ? '#2d8a4e' : '#268a45'} />
        ))}
        {/* Field outline */}
        <rect x="10" y="10" width="280" height="380" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.6" />
        {/* Center line */}
        <line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Center circle */}
        <circle cx="150" cy="200" r="40" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="150" cy="200" r="3" fill="white" fillOpacity="0.6" />
        {/* Top penalty area */}
        <rect x="70" y="10" width="160" height="60" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <rect x="100" y="10" width="100" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Top penalty arc */}
        <path d="M 110 70 Q 150 90 190 70" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Bottom penalty area */}
        <rect x="70" y="330" width="160" height="60" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <rect x="100" y="365" width="100" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Bottom penalty arc */}
        <path d="M 110 330 Q 150 310 190 330" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Corner arcs */}
        <path d="M 10 17 Q 17 17 17 10" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 283 10 Q 283 17 290 17" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 10 383 Q 17 383 17 390" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 283 390 Q 283 383 290 383" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
      </svg>

      {/* Player avatars */}
      {players.map((player, i) => {
        const [xPct, yPct] = FIELD_POSITIONS[i] ?? [50, 50]
        return (
          <div
            key={player.id}
            className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${xPct}%`, top: `${yPct}%` }}
          >
            <div className="rounded-sm overflow-hidden border border-white/40 shadow-sm bg-black/20">
              <PixelAvatar data={player.pixel_avatar} size={24} />
            </div>
            <span className="text-[8px] font-medium text-white bg-black/50 rounded px-1 leading-tight max-w-[60px] truncate">
              {player.name.split(' ')[0]}
            </span>
          </div>
        )
      })}

      {/* Empty slots */}
      {players.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/60 text-sm font-medium bg-black/30 rounded-full px-3 py-1">
            Sin jugadores aún
          </span>
        </div>
      )}
    </div>
  )
}
