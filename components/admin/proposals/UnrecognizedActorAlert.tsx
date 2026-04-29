'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UnrecognizedActorAlertProps {
  clientId: string
  actorName: string
  actorEmail: string
  actorLang: 'pt-BR' | 'en-US' | null
  decisionEvent: 'approved' | 'rejected'
}

/**
 * Yellow card shown above the proposal editor when the person who
 * approved/rejected isn't in client_contacts. Lets the owner add them
 * as a non-primary contact in one click, so future proposals to the
 * same client can include them as a CC.
 *
 * Dismissed in two ways:
 *   - "Adicionar como contato" → POST creates contact, router.refresh()
 *     re-fetches the page, the alert disappears (because now the email
 *     matches a contact).
 *   - "Ignorar" → local state, the card hides until next page load.
 *     Doesn't persist anywhere (kept simple — owner will see again next
 *     time but that's fine; if they really don't want to add, they
 *     never click and ignore again).
 */
export function UnrecognizedActorAlert({
  clientId,
  actorName,
  actorEmail,
  actorLang,
  decisionEvent,
}: UnrecognizedActorAlertProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (dismissed) return null

  const verb = decisionEvent === 'approved' ? 'aprovou' : 'recusou'

  const handleAdd = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/contacts/from-decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: actorName,
            email: actorEmail,
            lang: actorLang || 'pt-BR',
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao criar contato')
        setSubmitting(false)
        return
      }
      // Success — refresh the page so the server re-fetches contacts and
      // the alert disappears (email now matches an existing contact).
      router.refresh()
    } catch (e) {
      setError(`Erro de rede: ${(e as Error).message}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-medium">
            <strong>{actorName}</strong> ({actorEmail}) {verb} esta proposta,
            mas não está no cadastro de contatos deste cliente.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Adicionar como contato facilita o envio de futuras propostas e
            mantém o cadastro consistente. Idioma detectado:{' '}
            <span className="font-mono">{actorLang || 'pt-BR'}</span>.
          </p>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ignorar"
          className="rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
          disabled={submitting}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={submitting}
          className="gap-2"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          {submitting ? 'Adicionando…' : 'Adicionar como contato'}
        </Button>
      </div>
    </div>
  )
}
