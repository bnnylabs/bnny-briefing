'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Clipboard,
  ClipboardCheck,
  Mail,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Step 4 (final) of the new-briefing wizard. Shown after the briefing
 * was successfully created and the link generated.
 *
 * Three pieces of feedback:
 *   1. Email status — green card if `emailSent`, red if not (typically
 *      means the client has no email on file). Hidden when the client
 *      doesn't have an email at all.
 *   2. The generated public link, monospace + breakable.
 *   3. Action buttons: copy link, view client (if id available), or
 *      go to the admin panel.
 *
 * Local state: `copied` for the temporary checkmark on the copy button.
 * Manages its own clipboard timer to keep the parent component's state
 * surface smaller.
 *
 * Pulled out of app/admin/novo/page.tsx in v0.10.105.
 */

interface ClientFormSnapshot {
  id?: string
  name: string
  company: string
  email: string
}

export function PreviewStep({
  clientForm,
  generatedLink,
  emailSent,
  onGoToClient,
  onGoToAdmin,
}: {
  clientForm: ClientFormSnapshot
  generatedLink: string
  emailSent: boolean
  /** Called when user clicks "Ver cliente" (only available with clientForm.id). */
  onGoToClient: (clientId: string) => void
  /** Called when user clicks "Ver painel" or "Ir para o painel". */
  onGoToAdmin: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <PartyPopper className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mb-2 font-mono text-2xl font-bold tracking-tight">
        Briefing criado!
      </h2>
      <p className="mb-7 text-sm text-muted-foreground">
        Pronto para <strong className="text-foreground">{clientForm.name}</strong>{' '}
        da <strong className="text-foreground">{clientForm.company}</strong>
      </p>

      {clientForm.email && (
        <Card
          className={cn(
            'mb-5 p-3 text-sm',
            emailSent
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
        >
          {emailSent ? (
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email enviado para {clientForm.email}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Email não enviado — copie e envie o link manualmente
            </span>
          )}
        </Card>
      )}

      <Card className="mb-3.5 p-4 text-left">
        <div className="mb-1.5 text-xs text-muted-foreground">
          Link do briefing
        </div>
        <div className="break-all font-mono text-sm text-primary">
          {generatedLink}
        </div>
      </Card>

      <div className="mb-2.5 flex gap-2.5">
        <Button onClick={copyLink} className="flex-1">
          {copied ? (
            <>
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Clipboard className="mr-1.5 h-4 w-4" />
              Copiar link
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            clientForm.id ? onGoToClient(clientForm.id) : onGoToAdmin()
          }
          className="flex-1"
        >
          {clientForm.id ? 'Ver cliente' : 'Ver painel'}
        </Button>
      </div>
      <Button variant="ghost" onClick={onGoToAdmin} className="w-full">
        Ir para o painel
      </Button>
    </div>
  )
}
