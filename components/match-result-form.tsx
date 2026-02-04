'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Save } from 'lucide-react'
import { saveMatchResult } from '@/app/actions/matches'
import type { ResultTeam } from '@/lib/db'
import { FootballLoader } from '@/components/football-loader'

interface MatchResultFormProps {
  matchId: number
  isCreator: boolean
  currentResult: {
    winner: ResultTeam | null
    scoreA: number | null
    scoreB: number | null
    notes: string | null
  }
}

export function MatchResultForm({ matchId, isCreator, currentResult }: MatchResultFormProps) {
  const [winner, setWinner] = useState<ResultTeam | null>(currentResult.winner)
  const [scoreA, setScoreA] = useState(currentResult.scoreA?.toString() || '')
  const [scoreB, setScoreB] = useState(currentResult.scoreB?.toString() || '')
  const [notes, setNotes] = useState(currentResult.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError('')
    setSuccess(false)

    const result = await saveMatchResult(
      matchId,
      winner,
      scoreA ? parseInt(scoreA) : null,
      scoreB ? parseInt(scoreB) : null,
      notes || null
    )

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setLoading(false)
  }

  // If there's a result and user is not creator, show read-only view
  if (!isCreator && currentResult.winner) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-8">
            <div className={`flex flex-col items-center p-4 rounded-lg ${currentResult.winner === 'A' ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50'}`}>
              <span className="text-sm font-medium text-muted-foreground">Equipo A</span>
              <span className="text-3xl font-bold">{currentResult.scoreA ?? '-'}</span>
              {currentResult.winner === 'A' && <span className="text-xs text-primary font-medium">Ganador</span>}
            </div>
            <span className="text-2xl font-bold text-muted-foreground">vs</span>
            <div className={`flex flex-col items-center p-4 rounded-lg ${currentResult.winner === 'B' ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50'}`}>
              <span className="text-sm font-medium text-muted-foreground">Equipo B</span>
              <span className="text-3xl font-bold">{currentResult.scoreB ?? '-'}</span>
              {currentResult.winner === 'B' && <span className="text-xs text-primary font-medium">Ganador</span>}
            </div>
          </div>
          {currentResult.winner === 'DRAW' && (
            <p className="text-center text-muted-foreground">Empate</p>
          )}
          {currentResult.notes && (
            <p className="text-sm text-muted-foreground border-t pt-3">{currentResult.notes}</p>
          )}
        </CardContent>
      </Card>
    )
  }

  // If there's no result and user is not creator, show nothing
  if (!isCreator) {
    return null
  }

  // Creator can edit the result
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Resultado del partido
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Score inputs */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm text-muted-foreground">Equipo A</Label>
            <Input
              type="number"
              min="0"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="w-20 text-center text-xl font-bold"
              placeholder="-"
            />
          </div>
          <span className="text-xl font-bold text-muted-foreground mt-6">vs</span>
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm text-muted-foreground">Equipo B</Label>
            <Input
              type="number"
              min="0"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="w-20 text-center text-xl font-bold"
              placeholder="-"
            />
          </div>
        </div>

        {/* Winner selection */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm">Ganador</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setWinner('A')}
              className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                winner === 'A'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              Equipo A
            </button>
            <button
              type="button"
              onClick={() => setWinner('DRAW')}
              className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                winner === 'DRAW'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              Empate
            </button>
            <button
              type="button"
              onClick={() => setWinner('B')}
              className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                winner === 'B'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              Equipo B
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes" className="text-sm">Notas (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Gran partido, Juan hizo 3 goles..."
            className="resize-none"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Resultado guardado</p>}

        <Button onClick={handleSave} disabled={loading} className="gap-2">
          {loading ? (
            <FootballLoader size="sm" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar resultado
        </Button>
      </CardContent>
    </Card>
  )
}
