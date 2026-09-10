'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Pencil, Plus } from 'lucide-react'

import {
  createFieldAction,
  deactivateFieldAction,
  updateFieldAction,
} from '@/app/actions/fields'
import { useErrorToast } from '@/components/error-toast-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { normalizeFieldSlug, type Field } from '@/lib/fields'

type FieldFormState = {
  name: string
  slug: string
  maps_url: string
  cancellation_deadline_hours: string
  cancellation_reminder_offset_hours: string
  cancellation_penalty: string
  notes: string
  atc_venue_slug: string
  is_active: boolean
}

function emptyForm(): FieldFormState {
  return {
    name: '',
    slug: '',
    maps_url: '',
    cancellation_deadline_hours: '24',
    cancellation_reminder_offset_hours: '1',
    cancellation_penalty: '',
    notes: '',
    atc_venue_slug: '',
    is_active: true,
  }
}

function fieldToForm(field: Field): FieldFormState {
  return {
    name: field.name,
    slug: field.slug,
    maps_url: field.maps_url || '',
    cancellation_deadline_hours: String(field.cancellation_deadline_hours),
    cancellation_reminder_offset_hours: String(field.cancellation_reminder_offset_hours),
    cancellation_penalty: field.cancellation_penalty || '',
    notes: field.notes || '',
    atc_venue_slug: field.atc_venue_slug || '',
    is_active: field.is_active,
  }
}

type FieldsAdminClientProps = {
  initialFields: Field[]
}

export function FieldsAdminClient({ initialFields }: FieldsAdminClientProps): React.JSX.Element {
  const router = useRouter()
  const { showError } = useErrorToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FieldFormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  function openCreate(): void {
    setEditingId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(field: Field): void {
    setEditingId(field.id)
    setForm(fieldToForm(field))
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || normalizeFieldSlug(form.name),
      maps_url: form.maps_url.trim() || null,
      cancellation_deadline_hours: parseInt(form.cancellation_deadline_hours, 10) || 24,
      cancellation_reminder_offset_hours: parseInt(form.cancellation_reminder_offset_hours, 10) || 1,
      cancellation_penalty: form.cancellation_penalty.trim() || null,
      notes: form.notes.trim() || null,
      atc_venue_slug: form.atc_venue_slug.trim() || null,
      is_active: form.is_active,
    }

    const result = editingId
      ? await updateFieldAction(editingId, payload)
      : await createFieldAction(payload)

    setSaving(false)

    if (result.error) {
      showError('Error al guardar', result.error)
      return
    }

    setDialogOpen(false)
    router.refresh()
  }

  async function handleDeactivate(field: Field): Promise<void> {
    const result = await deactivateFieldAction(field.id)
    if (result.error) {
      showError('Error', result.error)
      return
    }
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva cancha
        </Button>
      </div>

      <div className="grid gap-3">
        {initialFields.map((field) => (
          <Card key={field.id} className={!field.is_active ? 'opacity-60' : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {field.name}
                    {!field.is_active && (
                      <span className="text-xs font-normal text-muted-foreground">(inactiva)</span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">slug: {field.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(field)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {field.is_active && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivate(field)}
                    >
                      Desactivar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Cancelación:</span>{' '}
                {field.cancellation_deadline_hours}h · recordatorio {field.cancellation_reminder_offset_hours}h antes
              </p>
              {field.cancellation_penalty && (
                <p className="text-muted-foreground">{field.cancellation_penalty}</p>
              )}
              {field.maps_url && (
                <p>
                  <a href={field.maps_url} target="_blank" rel="noreferrer" className="text-primary underline">
                    Ver en mapa
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar cancha' : 'Nueva cancha'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="field-name">Nombre</Label>
              <Input
                id="field-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-slug">Slug</Label>
              <Input
                id="field-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={normalizeFieldSlug(form.name) || 'terrazas'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-maps">URL de Google Maps</Label>
              <Input
                id="field-maps"
                type="url"
                value={form.maps_url}
                onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="field-deadline">Plazo cancelación (hs)</Label>
                <Input
                  id="field-deadline"
                  type="number"
                  min={0}
                  value={form.cancellation_deadline_hours}
                  onChange={(e) => setForm((f) => ({ ...f, cancellation_deadline_hours: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="field-reminder">Recordatorio antes (hs)</Label>
                <Input
                  id="field-reminder"
                  type="number"
                  min={0}
                  value={form.cancellation_reminder_offset_hours}
                  onChange={(e) => setForm((f) => ({ ...f, cancellation_reminder_offset_hours: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-penalty">Penalidad (texto)</Label>
              <Textarea
                id="field-penalty"
                value={form.cancellation_penalty}
                onChange={(e) => setForm((f) => ({ ...f, cancellation_penalty: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-notes">Notas</Label>
              <Textarea
                id="field-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-atc">ATC venue slug (opcional)</Label>
              <Input
                id="field-atc"
                value={form.atc_venue_slug}
                onChange={(e) => setForm((f) => ({ ...f, atc_venue_slug: e.target.value }))}
                placeholder="terrazas-bariloche"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="field-active">Activa</Label>
              <Switch
                id="field-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
