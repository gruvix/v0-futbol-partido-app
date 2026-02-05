'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Settings, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableFieldProps {
  /** The field label */
  label: string
  /** Current display value when not editing */
  displayValue: ReactNode
  /** Whether user can edit this field */
  canEdit: boolean
  /** Called when user confirms changes */
  onSave: () => Promise<{ error?: string } | void>
  /** Render prop for the edit UI */
  renderEditor: () => ReactNode
  /** Optional warning message shown below the editor */
  warning?: string
  /** Optional className for the container */
  className?: string
  /** Icon to show before the label */
  icon?: ReactNode
}

export function EditableField({
  label,
  displayValue,
  canEdit,
  onSave,
  renderEditor,
  warning,
  className,
  icon,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setError('')
  }, [])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setError('')
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError('')
    try {
      const result = await onSave()
      if (result?.error) {
        setError(result.error)
      } else {
        setIsEditing(false)
      }
    } catch (e) {
      setError('Error al guardar')
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }, [onSave])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Cancelar</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                >
                  <Check className="w-4 h-4" />
                  <span className="sr-only">Confirmar</span>
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              >
                <Settings className="w-4 h-4" />
                <span className="sr-only">Editar {label}</span>
              </Button>
            )}
          </div>
        )}
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2">
          {renderEditor()}
          {warning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
              {warning}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      ) : (
        <div className="text-foreground">{displayValue}</div>
      )}
    </div>
  )
}
