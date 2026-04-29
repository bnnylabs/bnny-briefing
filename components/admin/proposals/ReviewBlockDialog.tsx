'use client'

import { useEffect, useState } from 'react'
import { Loader2, Wand2, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  ProposalBlock,
  ProposalBlockContent,
} from '@/lib/proposal-types'
import { buildReviewDiffPairs, type ReviewFoco } from '@/lib/review'

/**
 * Dialog completo de revisão com IA pra um bloco.
 *
 * Fluxo em duas etapas:
 *
 *   1. Form (estado inicial)
 *      - Radio de foco: clareza | concisão | tom | tudo
 *      - Textarea opcional: instrução livre ("mais formal", "remove o
 *        prazo", etc.)
 *      - Botão "Revisar com IA" → chama endpoint review, vai pra etapa 2
 *
 *   2. Diff (depois da resposta)
 *      - Lista de campos textuais do bloco com before/after lado-a-lado
 *      - Campos sem mudança aparecem colapsados/discretos
 *      - Campos alterados aparecem destacados
 *      - Botões: Voltar (ajustar foco/instrução), Aceitar (aplica), Cancelar
 *
 * O componente NÃO persiste — quando o operador clica Aceitar, chama
 * onAccept(revised) e o parent aplica via patchBlock + auto-save normal.
 *
 * Reset de estado: ao fechar o dialog, volta pra etapa 1 limpa. Ao
 * "Voltar" da etapa 2, mantém foco/instrução pra ajuste rápido.
 */

const FOCO_OPTIONS: Array<{ value: ReviewFoco; label: string; desc: string }> = [
  { value: 'all', label: 'Geral', desc: 'Melhoria ampla — clareza, concisão e tom' },
  { value: 'clareza', label: 'Clareza', desc: 'Reescreve trechos confusos, ordena ideias' },
  { value: 'concisao', label: 'Concisão', desc: 'Corta gordura, encurta frases' },
  { value: 'tom', label: 'Tom', desc: 'Ajusta pra profissional, direto e humano' },
]

export interface ReviewBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  block: Pick<ProposalBlock, 'id' | 'type' | 'content'>
  /** Label de UI pra o tipo do bloco — ex: "Texto de abertura", "Fases". */
  blockLabel: string
  /** Aplicar a revisão. Parent chama patchBlock e fecha o dialog. */
  onAccept: (revised: ProposalBlockContent) => void
  onError?: (message: string) => void
}

type Stage = 'form' | 'loading' | 'preview'

export function ReviewBlockDialog({
  open,
  onOpenChange,
  slug,
  block,
  blockLabel,
  onAccept,
  onError,
}: ReviewBlockDialogProps) {
  const [stage, setStage] = useState<Stage>('form')
  const [foco, setFoco] = useState<ReviewFoco>('all')
  const [instruction, setInstruction] = useState('')

  const [revised, setRevised] = useState<ProposalBlockContent | null>(null)
  const [changedCount, setChangedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Reset stage every time the dialog reopens — keeps state predictable.
  useEffect(() => {
    if (open) {
      setStage('form')
      setRevised(null)
    }
  }, [open])

  const runReview = async () => {
    setStage('loading')
    try {
      const res = await fetch(
        `/api/proposals/${slug}/blocks/${block.id}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foco,
            instruction: instruction.trim() || undefined,
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Falha ao revisar')
      }
      const data = (await res.json()) as {
        revised: ProposalBlockContent
        changedCount: number
        totalCount: number
      }
      setRevised(data.revised)
      setChangedCount(data.changedCount)
      setTotalCount(data.totalCount)
      setStage('preview')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao revisar'
      onError?.(msg)
      setStage('form')
    }
  }

  const handleAccept = () => {
    if (!revised) return
    onAccept(revised)
    onOpenChange(false)
  }

  const diffPairs = revised
    ? buildReviewDiffPairs(block.type, block.content, revised)
    : []

  const dialogClose = (v: boolean) => {
    if (stage === 'loading') return // ignora close durante loading
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={dialogClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisar com IA · {blockLabel}</DialogTitle>
          <DialogDescription>
            {stage === 'form' &&
              'Escolha o foco e (opcionalmente) deixe uma instrução. A IA vai sugerir uma revisão sem trocar o idioma — você decide se aplica.'}
            {stage === 'loading' && 'Revisando o conteúdo do bloco…'}
            {stage === 'preview' &&
              (changedCount === 0
                ? 'A IA não sugeriu mudanças — o texto já está bom.'
                : `${changedCount} de ${totalCount} ${totalCount === 1 ? 'campo' : 'campos'} ${changedCount === 1 ? 'foi alterado' : 'foram alterados'}.`)}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Stage: form ────────────────────────────────────────── */}
        {stage === 'form' && (
          <div className="space-y-4 px-6">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Foco
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FOCO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFoco(opt.value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-left transition-colors',
                      foco === opt.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Instrução (opcional)
              </div>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='Ex: "deixa mais formal", "remove a menção ao prazo", "encurta o intro"'
                rows={2}
                className={cn(
                  'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
                )}
                maxLength={1000}
              />
            </div>
          </div>
        )}

        {/* ─── Stage: loading ─────────────────────────────────────── */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center px-6 py-12">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Revisando…</p>
            </div>
          </div>
        )}

        {/* ─── Stage: preview ─────────────────────────────────────── */}
        {stage === 'preview' && revised && (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto px-6">
            {diffPairs.map((pair, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-md border p-3',
                  pair.changed
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border opacity-60',
                )}
              >
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
                  <span className="text-muted-foreground">{pair.label}</span>
                  {pair.changed ? (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-foreground">
                      alterado
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">sem mudança</span>
                  )}
                </div>
                {pair.changed ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Antes
                      </div>
                      <div className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground">
                        {pair.before || (
                          <span className="italic opacity-60">(vazio)</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                        Depois
                      </div>
                      <div className="whitespace-pre-wrap rounded bg-primary/10 p-2 text-xs leading-relaxed text-foreground">
                        {pair.after || (
                          <span className="italic opacity-60">(vazio)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {pair.before || (
                      <span className="italic opacity-60">(vazio)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="p-6 pt-2">
          {stage === 'form' && (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button onClick={runReview} type="button">
                <Wand2 className="mr-1.5 h-4 w-4" />
                Revisar com IA
              </Button>
            </>
          )}
          {stage === 'loading' && (
            <Button disabled type="button">
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Revisando…
            </Button>
          )}
          {stage === 'preview' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStage('form')}
                type="button"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Ajustar e revisar de novo
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAccept}
                disabled={changedCount === 0}
                type="button"
              >
                Aplicar revisão
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
