'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Starting positions (% of field) for 5v5. */
const FIELD_POSITIONS_5V5: [number, number][] = [
  [50, 92], [30, 74], [70, 74], [30, 56], [70, 56],
  [50, 8],  [30, 26], [70, 26], [30, 44], [70, 44],
]

/** Physics body for players and ball. */
interface Body { x: number; y: number; vx: number; vy: number }

/** Radius of a player avatar in %-of-field coordinates. */
const PLAYER_R = 5
/** Radius of the ball in %-of-field coordinates. */
const BALL_R = 2
/** Field boundaries (with some padding so avatars don't clip). */
const BOUNDS = { minX: 6, maxX: 94, minY: 4, maxY: 96 }
/** Base speed factor for players. */
const PLAYER_SPEED = 0.02
/** Ball speed factor (faster than players). */
const BALL_SPEED = 0.06
/** Friction applied every frame. */
const FRICTION = 0.998
/** Ball kick impulse when hitting a player. */
const KICK_IMPULSE = 0.08

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function randomVelocity(scale: number): [number, number] {
  const angle = Math.random() * Math.PI * 2
  return [Math.cos(angle) * scale, Math.sin(angle) * scale]
}

export function SoccerField({ participants, maxPlayers }: SoccerFieldProps) {
  const players = useMemo(
    () => participants.filter((p) => p.role === 'PLAYER').slice(0, Math.min(maxPlayers, FIELD_POSITIONS_5V5.length)),
    [participants, maxPlayers],
  )

  const bodiesRef = useRef<Body[]>([])
  const initialBallV = useMemo(() => randomVelocity(BALL_SPEED), [])
  const ballRef = useRef<Body>({ x: 50, y: 50, vx: initialBallV[0], vy: initialBallV[1] })
  const rafRef = useRef<number>(0)
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([])
  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 })

  // Initialize bodies when player list changes.
  useEffect(() => {
    bodiesRef.current = players.map((_, i) => {
      const [px, py] = FIELD_POSITIONS_5V5[i] ?? [50, 50]
      const [vx, vy] = randomVelocity(PLAYER_SPEED)
      return { x: px, y: py, vx, vy }
    })
    setPositions(bodiesRef.current.map((b) => ({ x: b.x, y: b.y })))
  }, [players])

  const tick = useCallback(() => {
    const bodies = bodiesRef.current
    const ball = ballRef.current

    // Move players
    for (const b of bodies) {
      b.x += b.vx
      b.y += b.vy
      b.vx *= FRICTION
      b.vy *= FRICTION

      // Occasionally nudge so they keep moving
      if (Math.random() < 0.01) {
        const [nvx, nvy] = randomVelocity(PLAYER_SPEED)
        b.vx += nvx
        b.vy += nvy
      }

      // Wall bounce
      if (b.x < BOUNDS.minX) { b.x = BOUNDS.minX; b.vx = Math.abs(b.vx) }
      if (b.x > BOUNDS.maxX) { b.x = BOUNDS.maxX; b.vx = -Math.abs(b.vx) }
      if (b.y < BOUNDS.minY) { b.y = BOUNDS.minY; b.vy = Math.abs(b.vy) }
      if (b.y > BOUNDS.maxY) { b.y = BOUNDS.maxY; b.vy = -Math.abs(b.vy) }
    }

    // Player–player collisions
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = PLAYER_R * 2
        if (dist < minDist && dist > 0) {
          const nx = dx / dist, ny = dy / dist
          const overlap = (minDist - dist) / 2
          a.x -= nx * overlap; a.y -= ny * overlap
          b.x += nx * overlap; b.y += ny * overlap
          // Swap velocity components along collision normal
          const dvx = a.vx - b.vx, dvy = a.vy - b.vy
          const dot = dvx * nx + dvy * ny
          a.vx -= dot * nx; a.vy -= dot * ny
          b.vx += dot * nx; b.vy += dot * ny
        }
      }
    }

    // Move ball
    ball.x += ball.vx
    ball.y += ball.vy
    ball.vx *= FRICTION
    ball.vy *= FRICTION

    // Ball wall bounce
    if (ball.x < BOUNDS.minX) { ball.x = BOUNDS.minX; ball.vx = Math.abs(ball.vx) }
    if (ball.x > BOUNDS.maxX) { ball.x = BOUNDS.maxX; ball.vx = -Math.abs(ball.vx) }
    if (ball.y < BOUNDS.minY) { ball.y = BOUNDS.minY; ball.vy = Math.abs(ball.vy) }
    if (ball.y > BOUNDS.maxY) { ball.y = BOUNDS.maxY; ball.vy = -Math.abs(ball.vy) }

    // Ball–player collisions (ball gets kicked away)
    for (const b of bodies) {
      const dx = ball.x - b.x, dy = ball.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const minDist = PLAYER_R + BALL_R
      if (dist < minDist && dist > 0) {
        const nx = dx / dist, ny = dy / dist
        ball.x = b.x + nx * minDist
        ball.y = b.y + ny * minDist
        ball.vx = nx * KICK_IMPULSE + b.vx * 0.5
        ball.vy = ny * KICK_IMPULSE + b.vy * 0.5
      }
    }

    // Keep ball in bounds after kick
    ball.x = clamp(ball.x, BOUNDS.minX, BOUNDS.maxX)
    ball.y = clamp(ball.y, BOUNDS.minY, BOUNDS.maxY)

    setPositions(bodies.map((b) => ({ x: b.x, y: b.y })))
    setBallPos({ x: ball.x, y: ball.y })

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border" style={{ aspectRatio: '3 / 4' }}>
      {/* Field background */}
      <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <rect width="300" height="400" fill="#2d8a4e" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="0" y={i * 50} width="300" height="50" fill={i % 2 === 0 ? '#2d8a4e' : '#268a45'} />
        ))}
        <rect x="10" y="10" width="280" height="380" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.6" />
        <line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="150" cy="200" r="40" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="150" cy="200" r="3" fill="white" fillOpacity="0.6" />
        <rect x="70" y="10" width="160" height="60" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <rect x="100" y="10" width="100" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <path d="M 110 70 Q 150 90 190 70" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <rect x="70" y="330" width="160" height="60" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <rect x="100" y="365" width="100" height="25" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <path d="M 110 330 Q 150 310 190 330" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
        <path d="M 10 17 Q 17 17 17 10" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 283 10 Q 283 17 290 17" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 10 383 Q 17 383 17 390" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M 283 390 Q 283 383 290 383" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
      </svg>

      {/* Ball */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
        style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" fill="white" stroke="#333" strokeWidth="1" />
          <path d="M8 1 L9.5 4.5 L13 5 L10.5 8 L11 12 L8 10 L5 12 L5.5 8 L3 5 L6.5 4.5 Z" fill="none" stroke="#333" strokeWidth="0.5" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* Player avatars */}
      {players.map((player, i) => {
        const pos = positions[i]
        if (!pos) return null
        return (
          <div
            key={player.id}
            className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <PixelAvatar data={player.pixel_avatar} size={48} />
            <span className="text-[9px] font-medium text-white bg-black/50 rounded px-1 leading-tight max-w-[70px] truncate">
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
