'use client'

import * as React from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const TEXTAREA_CLASSES =
  'block w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface DecisionBarProps {
  slug: string
  /** Status from the server. Bar only renders if 'sent' or 'viewed'. */
  status: string
}

/**
 * Pair of buttons + dialogs for the public proposal page. Client clicks
 * "Aprovar" → form (nome, email, checkbox de aceite) → POST → redirect
 * to a success view. "Recusar" → form (nome, email, motivo opcional)
 * → POST → success view.
 *
 * On success, we router.refresh() so the server component re-renders
 * and the proposal status reflects the new state. The bar itself
 * unmounts because it only renders for 'sent'/'viewed'.
 */
export function DecisionBar({ slug, status }: DecisionBarProps) {
  const [approveOpen, setApproveOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Approval form state
  const [aName, setAName] = React.useState('')
  const [aEmail, setAEmail] = React.useState('')
  const [aTerms, setATerms] = React.useState(false)
  const [aError, setAError] = React.useState<string | null>(null)

  // Reject form state
  const [rName, setRName] = React.useState('')
  const [rEmail, setREmail] = React.useState('')
  const [rReason, setRReason] = React.useState('')
  const [rError, setRError] = React.useState<string | null>(null)

  // Local "decided" override so the UI updates immediately on success,
  // without waiting for the server round-trip + revalidation. Once the
  // page next re-renders from the server, the prop `status` will catch
  // up and this state becomes redundant.
  const [decided, setDecided] = React.useState<'approved' | 'rejected' | null>(null)

  // Don't render the bar at all if the proposal isn't actionable.
  if (status !== 'sent' && status !== 'viewed' && !decided) return null

  // Show a confirmation panel after a successful action — keeps the
  // client on the same page with feedback instead of "where did the
  // buttons go".
  if (decided === 'approved') {
    return (
      <div className="my-12 rounded-lg border border-primary/40 bg-primary/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="font-mono text-sm font-bold">Proposta aprovada</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Recebemos sua aprovação. O estúdio vai entrar em contato em breve.
        </p>
      </div>
    )
  }
  if (decided === 'rejected') {
    return (
      <div className="my-12 rounded-lg border border-border bg-muted/40 p-6 text-center">
        <XCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-mono text-sm font-bold">Resposta registrada</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Obrigado pelo retorno. O estúdio foi notificado.
        </p>
      </div>
    )
  }

  const submitApprove = async () => {
    setAError(null)
    if (!aName.trim()) {
      setAError('Nome é obrigatório')
      return
    }
    if (!aEmail.trim() || !aEmail.includes('@')) {
      setAError('E-mail válido é obrigatório')
      return
    }
    if (!aTerms) {
      setAError('Você precisa aceitar os termos')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/p/${slug}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          actor_name: aName.trim(),
          actor_email: aEmail.trim(),
          terms_accepted: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAError(data.error || 'Erro ao registrar aprovação')
        setSubmitting(false)
        return
      }
      setApproveOpen(false)
      setDecided('approved')
    } catch (e) {
      setAError(`Erro de rede: ${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const submitReject = async () => {
    setRError(null)
    if (!rName.trim()) {
      setRError('Nome é obrigatório')
      return
    }
    if (!rEmail.trim() || !rEmail.includes('@')) {
      setRError('E-mail válido é obrigatório')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/p/${slug}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          actor_name: rName.trim(),
          actor_email: rEmail.trim(),
          reason: rReason.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRError(data.error || 'Erro ao registrar recusa')
        setSubmitting(false)
        return
      }
      setRejectOpen(false)
      setDecided('rejected')
    } catch (e) {
      setRError(`Erro de rede: ${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Decision bar — sits between content and footer */}
      <div className="my-12 rounded-lg border border-border bg-card p-6">
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
          O que você decide?
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Aprovar fecha o orçamento e dispara o início do projeto. Recusar
          encerra esta proposta — pode ser que o estúdio entre em contato
          pra entender o que ajustar.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => setApproveOpen(true)}
            className="gap-2 sm:flex-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprovar proposta
          </Button>
          <Button
            variant="ghost"
            onClick={() => setRejectOpen(true)}
            className="gap-2 sm:flex-1"
          >
            <XCircle className="h-4 w-4" />
            Recusar
          </Button>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={(o) => !submitting && setApproveOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar proposta</DialogTitle>
            <DialogDescription>
              Confirme seus dados e aceite os termos pra registrar a aprovação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="approve-name">Seu nome *</Label>
              <Input
                id="approve-name"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                placeholder="Nome completo"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="approve-email">E-mail *</Label>
              <Input
                id="approve-email"
                type="email"
                value={aEmail}
                onChange={(e) => setAEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={submitting}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-xs">
              <Checkbox
                checked={aTerms}
                onCheckedChange={(v) => setATerms(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Li e aceito os termos descritos nesta proposta — escopo,
                cronograma, valor, condições de pagamento.
              </span>
            </label>
            {aError && (
              <p className="text-xs text-destructive">{aError}</p>
            )}
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setApproveOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={submitApprove} disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitting ? 'Registrando…' : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(o) => !submitting && setRejectOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar proposta</DialogTitle>
            <DialogDescription>
              Identifique-se e, se quiser, conte rapidamente o motivo. Ajuda
              a calibrar a próxima conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="reject-name">Seu nome *</Label>
              <Input
                id="reject-name"
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder="Nome completo"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="reject-email">E-mail *</Label>
              <Input
                id="reject-email"
                type="email"
                value={rEmail}
                onChange={(e) => setREmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="reject-reason">Motivo (opcional)</Label>
              <textarea
                id="reject-reason"
                value={rReason}
                onChange={(e) => setRReason(e.target.value)}
                rows={3}
                placeholder="Ex: prazo está apertado, escopo precisa rever, orçamento fora do esperado…"
                disabled={submitting}
                className={TEXTAREA_CLASSES}
              />
            </div>
            {rError && (
              <p className="text-xs text-destructive">{rError}</p>
            )}
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={submitReject} disabled={submitting} variant="destructive" className="gap-2">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {submitting ? 'Registrando…' : 'Confirmar recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
