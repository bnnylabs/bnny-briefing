'use client'

import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Dialogs that live inside the proposal editor's footer. Extracted out
 * of ProposalEditor.tsx (v0.10.98) because they have stable contracts —
 * state and handlers stay in the parent, the dialog is pure presentation
 * + a confirmation surface.
 *
 * Why all three in one file:
 *   - They share the same visual scaffolding (Dialog + DialogContent +
 *     DialogHeader + footer with two buttons).
 *   - They're each <60L. Splitting into three files would create more
 *     navigation cost than it saves.
 *   - They're discovered together (operator opens "More actions" and
 *     sees Trocar cliente / Trocar modelo side by side).
 *
 * If any one of them grows substantially (form validation, custom
 * inputs, loading states beyond a single spinner), it gets its own
 * file. For now they're cousins, not strangers.
 */

// ─── Delete block ────────────────────────────────────────────────────────

/**
 * Hard confirm before removing a block from the proposal. Triggered by
 * the trash icon on each block card. The parent owns `deleteTarget`
 * state — when null, dialog is closed; when set to a block, dialog
 * shows. `onConfirm` performs the actual delete + state update.
 */
export function DeleteBlockDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover seção?</DialogTitle>
          <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="p-6 pt-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Change client ────────────────────────────────────────────────────────

export interface ClientOption {
  id: string
  company: string
  name: string
}

/**
 * Re-points the proposal at a different client. Doesn't rewrite content —
 * the operator is told to use the AI card if they want fresh copy. The
 * parent lazy-loads `clients` when the dialog opens (avoiding a full
 * client list query on every editor mount).
 *
 * `value` empty = no choice yet → submit disabled.
 */
export function ChangeClientDialog({
  open,
  onOpenChange,
  clients,
  value,
  onValueChange,
  saving,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: ClientOption[]
  value: string
  onValueChange: (v: string) => void
  saving: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar cliente</DialogTitle>
          <DialogDescription>
            Os dados do novo cliente passam a ser usados no contexto da IA.
            O conteúdo já escrito não muda — use o card de IA para regenerar
            se quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company}{' '}
                  {c.name && (
                    <span className="text-muted-foreground">· {c.name}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="p-6 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving || !value}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Salvando…
              </>
            ) : (
              'Trocar cliente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Change template ──────────────────────────────────────────────────────

export interface TemplateOption {
  id: string
  name: string
  type: string | null
}

/**
 * Switches which template the proposal is linked to. Doesn't rewrite
 * existing content — same posture as ChangeClientDialog. Empty value
 * (no template) is a valid choice (sets template_id to null), so the
 * confirm button isn't gated on `value`.
 */
export function ChangeTemplateDialog({
  open,
  onOpenChange,
  templates,
  value,
  onValueChange,
  saving,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: TemplateOption[]
  value: string
  onValueChange: (v: string) => void
  saving: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar modelo</DialogTitle>
          <DialogDescription>
            Apenas o vínculo com o modelo é trocado. O conteúdo atual da
            proposta não é apagado — você pode usar o card de IA para
            regenerar fases e abertura segundo o novo modelo.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="p-6 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Salvando…
              </>
            ) : (
              'Trocar modelo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
