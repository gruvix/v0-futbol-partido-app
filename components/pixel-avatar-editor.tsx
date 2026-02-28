'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser, Trash2 } from 'lucide-react'

const GRID_SIZE = 16
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE

const PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff',
  '#00aa44', '#884400', '#ff6688', '#aaaaaa', '#555555',
  '#88ccff',
]

function createEmptyGrid(): (string | null)[] {
  return new Array(TOTAL_PIXELS).fill(null)
}

interface PixelAvatarEditorProps {
  initialData: string | null | undefined
  onSave: (data: string) => Promise<void>
  saving?: boolean
}

export function PixelAvatarEditor({ initialData, onSave, saving = false }: PixelAvatarEditorProps) {
  const [pixels, setPixels] = useState<(string | null)[]>(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData)
        if (Array.isArray(parsed) && parsed.length === TOTAL_PIXELS) return parsed
      } catch {
        // ignore
      }
    }
    return createEmptyGrid()
  })

  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0])
  const [eraseMode, setEraseMode] = useState(false)
  const [customColor, setCustomColor] = useState('#000000')
  const isPainting = useRef(false)

  const paint = useCallback(
    (index: number) => {
      setPixels((prev) => {
        const next = [...prev]
        next[index] = eraseMode ? null : selectedColor
        return next
      })
    },
    [eraseMode, selectedColor],
  )

  const handlePointerDown = useCallback(
    (index: number) => {
      isPainting.current = true
      paint(index)
    },
    [paint],
  )

  const handlePointerEnter = useCallback(
    (index: number) => {
      if (isPainting.current) paint(index)
    },
    [paint],
  )

  const handlePointerUp = useCallback(() => {
    isPainting.current = false
  }, [])

  const handleClear = () => setPixels(createEmptyGrid())

  const handleSave = async () => {
    await onSave(JSON.stringify(pixels))
  }

  const cellSize = 100 / GRID_SIZE

  return (
    <div className="flex flex-col gap-4" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      {/* Canvas grid */}
      <div className="border border-border rounded-lg overflow-hidden bg-muted/30 touch-none select-none" style={{ aspectRatio: '1' }}>
        <svg
          viewBox="0 0 100 100"
          width="100%"
          style={{ imageRendering: 'pixelated', display: 'block' }}
        >
          {/* Background grid */}
          {pixels.map((color, i) => {
            const x = (i % GRID_SIZE) * cellSize
            const y = Math.floor(i / GRID_SIZE) * cellSize
            // Checkerboard for transparent cells
            const isEven = ((i % GRID_SIZE) + Math.floor(i / GRID_SIZE)) % 2 === 0
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={color ?? (isEven ? '#e5e7eb' : '#d1d5db')}
                onPointerDown={(e) => {
                  e.preventDefault()
                  handlePointerDown(i)
                }}
                onPointerEnter={() => handlePointerEnter(i)}
                style={{ cursor: eraseMode ? 'crosshair' : 'pointer' }}
              />
            )
          })}
          {/* Grid lines */}
          {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * cellSize}
              x2={100}
              y2={i * cellSize}
              stroke="#00000015"
              strokeWidth={0.15}
            />
          ))}
          {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
            <line
              key={`v-${i}`}
              x1={i * cellSize}
              y1={0}
              x2={i * cellSize}
              y2={100}
              stroke="#00000015"
              strokeWidth={0.15}
            />
          ))}
        </svg>
      </div>

      {/* Palette */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className="w-7 h-7 rounded-md border-2 transition-all"
              style={{
                backgroundColor: color,
                borderColor: !eraseMode && selectedColor === color ? 'var(--primary)' : 'transparent',
                boxShadow: !eraseMode && selectedColor === color ? '0 0 0 2px var(--primary)' : 'none',
              }}
              onClick={() => {
                setSelectedColor(color)
                setEraseMode(false)
              }}
              aria-label={`Color ${color}`}
            />
          ))}
          {/* Custom color picker */}
          <label
            className="w-7 h-7 rounded-md border-2 overflow-hidden cursor-pointer transition-all relative"
            style={{
              borderColor: !eraseMode && !PALETTE.includes(selectedColor) ? 'var(--primary)' : 'transparent',
              boxShadow: !eraseMode && !PALETTE.includes(selectedColor) ? '0 0 0 2px var(--primary)' : 'none',
              backgroundColor: customColor,
            }}
          >
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value)
                setSelectedColor(e.target.value)
                setEraseMode(false)
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={eraseMode ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setEraseMode(!eraseMode)}
          >
            <Eraser className="w-3.5 h-3.5" />
            Borrador
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleClear}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? 'Guardando...' : 'Guardar avatar'}
      </Button>
    </div>
  )
}
