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

type Lang = 'pt-BR' | 'en-US'

/**
 * Snapshot of the actor info from the latest 'approved'/'rejected'
 * proposal_activity row. Server fetches this and passes it down so
 * every contact who opens the link sees who decided — not just the
 * person who clicked in this session.
 */
export interface DecisionSnapshot {
  event: 'approved' | 'rejected'
  actor_name: string | null
  actor_email: string | null
  created_at: string
}

interface DecisionBarProps {
  slug: string
  /** Status from the server. Bar renders interactive UI for 'sent'/'viewed',
   *  a "decision already made" panel for 'approved'/'rejected', and nothing
   *  for other statuses. */
  status: string
  /** Language passed through from the page server component. Determined
   *  by the ?l=<lang> query string the /send route puts on each
   *  recipient's link. Defaults to pt-BR. */
  lang?: Lang
  /** Server-loaded actor data when the proposal is already decided.
   *  Null for sent/viewed (still pending) — and as a defensive fallback
   *  if the activity row is somehow missing. */
  decision?: DecisionSnapshot | null
}

/**
 * Strings dictionary. Colocated here because this is the only client
 * component on the public page that has copy. The server component has
 * its own (smaller) dict in page.tsx.
 */
function strings(lang: Lang) {
  if (lang === 'en-US') {
    return {
      // Bar
      barTitle: 'What do you decide?',
      barDescription:
        'Approving accepts the proposal and we kick off the project. Rejecting closes this proposal — we may follow up to understand what to adjust.',
      approveBtn: 'Approve proposal',
      rejectBtn: 'Reject',
      // Approved panel (after success or already-approved status)
      approvedTitle: 'Proposal approved',
      approvedSubtitle: 'We received your approval. The studio will be in touch soon.',
      approvedBy: (name: string, email: string | null, when: string) =>
        email ? `Approved by ${name} (${email}) on ${when}.` : `Approved by ${name} on ${when}.`,
      // Rejected panel
      rejectedTitle: 'Response recorded',
      rejectedSubtitle: 'Thanks for the feedback. The studio has been notified.',
      rejectedBy: (name: string, email: string | null, when: string) =>
        email ? `Recorded by ${name} (${email}) on ${when}.` : `Recorded by ${name} on ${when}.`,
      dateLocale: 'en-US' as const,
      // Approve dialog
      approveDialogTitle: 'Approve proposal',
      approveDialogDesc: 'Confirm your details and accept the terms to register the approval.',
      nameLabel: 'Your name *',
      namePlaceholder: 'Full name',
      emailLabel: 'Email *',
      emailPlaceholder: 'you@email.com',
      termsLabel:
        'I have read and accept the terms described in this proposal — scope, timeline, value, payment conditions.',
      cancelBtn: 'Cancel',
      confirmApproveBtn: 'Confirm approval',
      submittingBtn: 'Recording…',
      // Reject dialog
      rejectDialogTitle: 'Reject proposal',
      rejectDialogDesc:
        'Identify yourself and, if you wish, share the reason briefly. It helps shape the next conversation.',
      reasonLabel: 'Reason (optional)',
      reasonPlaceholder:
        'e.g. tight timeline, scope needs review, budget out of range…',
      confirmRejectBtn: 'Confirm rejection',
      // Errors
      errNameRequired: 'Name is required',
      errEmailRequired: 'Valid email is required',
      errTermsRequired: 'You must accept the terms',
      errNetwork: (msg: string) => `Network error: ${msg}`,
      errGenericApprove: 'Error registering approval',
      errGenericReject: 'Error registering rejection',
    }
  }
  return {
    barTitle: 'O que você decide?',
    barDescription:
      'Aprovar fecha o orçamento e dispara o início do projeto. Recusar encerra esta proposta — pode ser que o estúdio entre em contato pra entender o que ajustar.',
    approveBtn: 'Aprovar proposta',
    rejectBtn: 'Recusar',
    approvedTitle: 'Proposta aprovada',
    approvedSubtitle: 'Recebemos sua aprovação. O estúdio vai entrar em contato em breve.',
    approvedBy: (name: string, email: string | null, when: string) =>
      email ? `Aprovada por ${name} (${email}) em ${when}.` : `Aprovada por ${name} em ${when}.`,
    rejectedTitle: 'Resposta registrada',
    rejectedSubtitle: 'Obrigado pelo retorno. O estúdio foi notificado.',
    rejectedBy: (name: string, email: string | null, when: string) =>
      email ? `Registrada por ${name} (${email}) em ${when}.` : `Registrada por ${name} em ${when}.`,
    dateLocale: 'pt-BR' as const,
    approveDialogTitle: 'Aprovar proposta',
    approveDialogDesc: 'Confirme seus dados e aceite os termos pra registrar a aprovação.',
    nameLabel: 'Seu nome *',
    namePlaceholder: 'Nome completo',
    emailLabel: 'E-mail *',
    emailPlaceholder: 'seu@email.com',
    termsLabel:
      'Li e aceito os termos descritos nesta proposta — escopo, cronograma, valor, condições de pagamento.',
    cancelBtn: 'Cancelar',
    confirmApproveBtn: 'Confirmar aprovação',
    submittingBtn: 'Registrando…',
    rejectDialogTitle: 'Recusar proposta',
    rejectDialogDesc:
      'Identifique-se e, se quiser, conte rapidamente o motivo. Ajuda a calibrar a próxima conversa.',
    reasonLabel: 'Motivo (opcional)',
    reasonPlaceholder:
      'Ex: prazo está apertado, escopo precisa rever, orçamento fora do esperado…',
    confirmRejectBtn: 'Confirmar recusa',
    errNameRequired: 'Nome é obrigatório',
    errEmailRequired: 'E-mail válido é obrigatório',
    errTermsRequired: 'Você precisa aceitar os termos',
    errNetwork: (msg: string) => `Erro de rede: ${msg}`,
    errGenericApprove: 'Erro ao registrar aprovação',
    errGenericReject: 'Erro ao registrar recusa',
  }
}

/**
 * Mask an email for public display: keep the first 4 characters of
 * the local part, replace the rest with asterisks, keep the domain
 * intact. Examples:
 *   "gc.krypto@icloud.com" → "gc.k****@icloud.com"
 *   "ana@x.com"            → "ana*@x.com"  (3 chars + 1 asterisk)
 *   "a@b.com"              → "a@b.com"     (too short to mask, leave it)
 *   null/empty             → null (caller renders without email)
 *
 * Why mask: this email shows on a public URL. If the link gets shared
 * (forwarded, posted in a chat), the actor's email shouldn't leak fully.
 * The first 4 chars are enough to recognize "this was Eduardo" while
 * not exposing the inbox to scrapers.
 */
function maskEmail(email: string | null): string | null {
  if (!email || !email.includes('@')) return null
  const [local, domain] = email.split('@')
  if (local.length <= 4) return email // not worth masking
  return `${local.slice(0, 4)}${'*'.repeat(Math.max(local.length - 4, 1))}@${domain}`
}

export function DecisionBar({
  slug,
  status,
  lang = 'pt-BR',
  decision,
}: DecisionBarProps) {
  const s = strings(lang)

  const [approveOpen, setApproveOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [aName, setAName] = React.useState('')
  const [aEmail, setAEmail] = React.useState('')
  const [aTerms, setATerms] = React.useState(false)
  const [aError, setAError] = React.useState<string | null>(null)

  const [rName, setRName] = React.useState('')
  const [rEmail, setREmail] = React.useState('')
  const [rReason, setRReason] = React.useState('')
  const [rError, setRError] = React.useState<string | null>(null)

  // Local override after successful submit so the same browser sees
  // immediate feedback without waiting for a server re-render. Stores
  // not just the event but also the actor data we just submitted —
  // covers the gap until the next page load picks up the persisted
  // proposal_activity row via getLatestDecision.
  const [localDecision, setLocalDecision] = React.useState<DecisionSnapshot | null>(null)

  // Effective decision = local (this session) ?? server (other sessions
  // / page reloads). Either way, we render the same panel.
  const effective: DecisionSnapshot | null =
    localDecision ||
    (decision && (decision.event === 'approved' || decision.event === 'rejected')
      ? decision
      : null)

  // Format the timestamp once if present.
  const formattedWhen = effective
    ? new Date(effective.created_at).toLocaleString(s.dateLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  // Has the proposal been decided either via local action or per server?
  const isApproved = effective?.event === 'approved' || status === 'approved'
  const isRejected = effective?.event === 'rejected' || status === 'rejected'

  if (isApproved) {
    return (
      <div className="my-12 rounded-lg border border-primary/40 bg-primary/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="font-mono text-sm font-bold">{s.approvedTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{s.approvedSubtitle}</p>
        {effective && effective.actor_name && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            {s.approvedBy(
              effective.actor_name,
              maskEmail(effective.actor_email),
              formattedWhen,
            )}
          </p>
        )}
      </div>
    )
  }
  if (isRejected) {
    return (
      <div className="my-12 rounded-lg border border-border bg-muted/40 p-6 text-center">
        <XCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-mono text-sm font-bold">{s.rejectedTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{s.rejectedSubtitle}</p>
        {effective && effective.actor_name && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            {s.rejectedBy(
              effective.actor_name,
              maskEmail(effective.actor_email),
              formattedWhen,
            )}
          </p>
        )}
      </div>
    )
  }

  // Anything other than 'sent'/'viewed' (draft, expired, revised) — bail
  // entirely. The page itself doesn't 404 on those, but the decision UI
  // doesn't make sense.
  if (status !== 'sent' && status !== 'viewed') return null

  const submitApprove = async () => {
    setAError(null)
    if (!aName.trim()) return setAError(s.errNameRequired)
    if (!aEmail.trim() || !aEmail.includes('@')) return setAError(s.errEmailRequired)
    if (!aTerms) return setAError(s.errTermsRequired)

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
          lang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAError(data.error || s.errGenericApprove)
        setSubmitting(false)
        return
      }
      setApproveOpen(false)
      setLocalDecision({
        event: 'approved',
        actor_name: aName.trim(),
        actor_email: aEmail.trim(),
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      setAError(s.errNetwork((e as Error).message))
    } finally {
      setSubmitting(false)
    }
  }

  const submitReject = async () => {
    setRError(null)
    if (!rName.trim()) return setRError(s.errNameRequired)
    if (!rEmail.trim() || !rEmail.includes('@')) return setRError(s.errEmailRequired)

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
          lang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRError(data.error || s.errGenericReject)
        setSubmitting(false)
        return
      }
      setRejectOpen(false)
      setLocalDecision({
        event: 'rejected',
        actor_name: rName.trim(),
        actor_email: rEmail.trim(),
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      setRError(s.errNetwork((e as Error).message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="my-12 rounded-lg border border-border bg-card p-6">
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
          {s.barTitle}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">{s.barDescription}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setApproveOpen(true)} className="gap-2 sm:flex-1">
            <CheckCircle2 className="h-4 w-4" />
            {s.approveBtn}
          </Button>
          <Button variant="ghost" onClick={() => setRejectOpen(true)} className="gap-2 sm:flex-1">
            <XCircle className="h-4 w-4" />
            {s.rejectBtn}
          </Button>
        </div>
      </div>

      <Dialog open={approveOpen} onOpenChange={(o) => !submitting && setApproveOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{s.approveDialogTitle}</DialogTitle>
            <DialogDescription>{s.approveDialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="approve-name">{s.nameLabel}</Label>
              <Input
                id="approve-name"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                placeholder={s.namePlaceholder}
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="approve-email">{s.emailLabel}</Label>
              <Input
                id="approve-email"
                type="email"
                value={aEmail}
                onChange={(e) => setAEmail(e.target.value)}
                placeholder={s.emailPlaceholder}
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
              <span className="text-muted-foreground">{s.termsLabel}</span>
            </label>
            {aError && <p className="text-xs text-destructive">{aError}</p>}
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setApproveOpen(false)}
              disabled={submitting}
            >
              {s.cancelBtn}
            </Button>
            <Button onClick={submitApprove} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? s.submittingBtn : s.confirmApproveBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(o) => !submitting && setRejectOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{s.rejectDialogTitle}</DialogTitle>
            <DialogDescription>{s.rejectDialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label htmlFor="reject-name">{s.nameLabel}</Label>
              <Input
                id="reject-name"
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder={s.namePlaceholder}
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="reject-email">{s.emailLabel}</Label>
              <Input
                id="reject-email"
                type="email"
                value={rEmail}
                onChange={(e) => setREmail(e.target.value)}
                placeholder={s.emailPlaceholder}
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="reject-reason">{s.reasonLabel}</Label>
              <textarea
                id="reject-reason"
                value={rReason}
                onChange={(e) => setRReason(e.target.value)}
                rows={3}
                placeholder={s.reasonPlaceholder}
                disabled={submitting}
                className={TEXTAREA_CLASSES}
              />
            </div>
            {rError && <p className="text-xs text-destructive">{rError}</p>}
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={submitting}
            >
              {s.cancelBtn}
            </Button>
            <Button onClick={submitReject} disabled={submitting} variant="destructive" className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {submitting ? s.submittingBtn : s.confirmRejectBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
