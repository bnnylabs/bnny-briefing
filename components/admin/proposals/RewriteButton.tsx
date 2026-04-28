'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Botão pequeno que reescreve um campo de texto via IA.
 *
 * Uso típico — posicionado absolute no canto superior direito de uma
 * textarea ou input wrapper:
 *
 *   <div className="relative">
 *     <textarea ... />
 *     <RewriteButton
 *       value={value}
 *       kind="phase_description"
 *       clientId={proposal.client_id}
 *       onRewritten={(text) => onChange(text)}
 *     />
 *   </div>
 *
 * O componente cuida do loading state e do toast — basta o consumidor
 * passar o callback de aplicação do texto reescrito.
 */
export function RewriteButton({
  value,
  kind,
  clientId,
  onRewritten,
  onError,
  className,
  /** Allows owner to type a short instruction ("mais curto", "mais formal") */
  extraContext,
}: {
  value: string
  kind: 'header_body' | 'phase_description' | 'investment_intro' | 'generic'
  clientId?: string | null
  onRewritten: (text: string) => void
  onError?: (message: string) => void
  className?: string
  extraContext?: string
}) {
  const [loading, setLoading] = useState(false)

  const handleRewrite = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/proposals/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: value,
          kind,
          client_id: clientId ?? undefined,
          extra_context: extraContext,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        onError?.(data.error || 'Falha ao reescrever')
        return
      }
      const data = await res.json()
      if (data.text) onRewritten(data.text)
    } catch {
      onError?.('Falha de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleRewrite}
      disabled={loading || !value.trim()}
      className={cn(
        'h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-primary',
        // Subtle by default; only catches the eye when the textarea
        // already has content the owner might want to improve.
        !value.trim() && 'opacity-40',
        className,
      )}
      aria-label="Reescrever com IA"
      title="Reescrever com IA"
    >
      {loading
        ? <><Loader2 className="h-3 w-3 animate-spin" />Reescrevendo</>
        : <><Sparkles className="h-3 w-3" />Reescrever</>}
    </Button>
  )
}
