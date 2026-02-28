'use client'

import { useMemo } from 'react'

const GRID_SIZE = 16

interface PixelAvatarProps {
  /** JSON string of 256 hex colors (or nulls). */
  data: string | null | undefined
  /** Rendered size in pixels. */
  size?: number
  className?: string
}

/**
 * Renders a 16×16 pixel-art avatar on a <canvas>-like SVG.
 * Falls back to a neutral silhouette when no data is provided.
 */
export function PixelAvatar({ data, size = 32, className }: PixelAvatarProps) {
  const pixels: (string | null)[] = useMemo(() => {
    if (!data) return []
    try {
      const parsed: unknown = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed as (string | null)[]
    } catch {
      // invalid JSON – fall through
    }
    return []
  }, [data])

  const cellSize = size / GRID_SIZE

  if (pixels.length === 0) {
    // Fallback: simple avatar placeholder
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
        className={className}
        role="img"
        aria-label="Avatar"
      >
        <rect width={GRID_SIZE} height={GRID_SIZE} fill="#d1d5db" rx="2" />
        <circle cx="8" cy="6" r="3" fill="#9ca3af" />
        <ellipse cx="8" cy="14" rx="5" ry="4" fill="#9ca3af" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Pixel avatar"
      style={{ imageRendering: 'pixelated' }}
    >
      {pixels.map((color, i) => {
        if (!color) return null
        const x = (i % GRID_SIZE) * cellSize
        const y = Math.floor(i / GRID_SIZE) * cellSize
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill={color}
          />
        )
      })}
    </svg>
  )
}
