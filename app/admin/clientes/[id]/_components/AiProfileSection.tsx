'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  Check,
  Clock,
  Maximize2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * The AI brand profile section in the client detail page sidebar.
 *
 * Two surfaces sharing the same state:
 *   - Compact Card → shows 4 summary fields (segment, tone, personality,
 *     positioning) when a profile exists, or a "Configurar perfil" CTA
 *     when empty
 *   - Maximize Dialog → opens via Edit, expand button, or empty-state
 *     CTA. Contains the IA analyzer (URL + extra text → /api/analyze),
 *     detected socials banner, and the full form (short fields grid +
 *     long-text fields).
 *
 * Pulled out of app/admin/clientes/[id]/page.tsx in v0.10.104. State
 * and the two async handlers (analyze, save) live here — parent only
 * passes the client and an `onSaved` callback to refresh its data.
 *
 * Why encapsulate everything: Card and Dialog share *all* the state
 * (aiProfile, editingAi, analyzing, detected socials, etc.). Splitting
 * into Card + Dialog separately would mean passing ~16 props into each
 * — verbose, error-prone, and the boundaries are artificial since the
 * Card is purely a preview of what's inside the Dialog.
 *
 * The detected socials side-effect (auto-saving social_* fields when
 * detected, auto-tagging from segment) is preserved exactly as it was
 * in the parent — analyze() populates `detectedSocials`, save() builds
 * the patch and tag-add logic before PATCH.
 */

interface SocialLinks {
  instagram?: string
  linkedin?: string
  facebook?: string
  youtube?: string
  tiktok?: string
  twitter?: string
  pinterest?: string
  other?: string
}

interface ClientForProfile {
  id: string
  company: string
  website: string | null
  analysis: Record<string, unknown> | null
  tags: string[]
  social_instagram: string | null
  social_linkedin: string | null
  social_facebook: string | null
  social_youtube: string | null
  social_tiktok: string | null
  social_twitter: string | null
  social_pinterest: string | null
  social_other: string | null
}

const AI_FIELDS: Array<{ key: string; label: string; long?: boolean }> = [
  { key: 'company_name', label: 'Nome da empresa' },
  { key: 'segment', label: 'Segmento / Nicho' },
  { key: 'target_audience', label: 'Público-alvo' },
  { key: 'brand_personality', label: 'Personalidade da marca' },
  { key: 'price_positioning', label: 'Posicionamento de preço' },
  { key: 'geographic_focus', label: 'Foco geográfico' },
  { key: 'tone_of_voice', label: 'Tom de voz' },
  { key: 'colors_hint', label: 'Direção de cores' },
  { key: 'description', label: 'Sobre a empresa', long: true },
  { key: 'key_features', label: 'Produtos / Serviços principais', long: true },
  { key: 'differentials', label: 'Diferenciais competitivos', long: true },
  { key: 'unique_value_proposition', label: 'Proposta de valor única', long: true },
  { key: 'extra_notes', label: 'Observações para design', long: true },
]

export function AiProfileSection({
  client,
  onSaved,
}: {
  client: ClientForProfile
  /**
   * Called after a successful save — parent should refresh its client
   * state (typically `load()`). Without this the parent would still
   * show stale data even though the card itself flipped to "Salvo".
   */
  onSaved: () => void
}) {
  // Hydrate from the client's stored analysis. When the parent's client
  // changes (load() updates it after save), this initializer doesn't
  // re-run — useEffect below syncs both aiProfile and analyzeUrl.
  const [aiProfile, setAiProfile] = useState<Record<string, string>>(
    () => (client.analysis as Record<string, string>) || {},
  )
  const [editingAi, setEditingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [analyzeUrl, setAnalyzeUrl] = useState(() => client.website ?? '')
  const [extraText, setExtraText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [detectedSocials, setDetectedSocials] = useState<SocialLinks>({})

  // Sync local state with client when parent reloads (e.g. after save).
  // Only runs when client.id changes (different client) or when the
  // stored analysis/website changes. Doesn't clobber in-flight edits
  // because editingAi short-circuits the sync.
  useEffect(() => {
    if (editingAi) return
    setAiProfile((client.analysis as Record<string, string>) || {})
    if (client.website) setAnalyzeUrl(client.website)
  }, [client.id, client.analysis, client.website, editingAi])

  const hasAiProfile = Object.keys(aiProfile).length > 0

  async function analyzeWithAI() {
    if (!analyzeUrl && !extraText && !client.company) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: analyzeUrl || client.website,
          text: extraText,
          company: client.company,
        }),
      })
      const data = await res.json()
      if (data.analysis) {
        setAiProfile(data.analysis)
        setEditingAi(true)
        setAiModalOpen(true)
      }
      if (data.social_links) {
        setDetectedSocials(data.social_links)
      }
    } catch (e) {
      console.error(e)
    }
    setAnalyzing(false)
  }

  async function saveAiProfile() {
    setSavingAi(true)
    const socialPatch =
      Object.keys(detectedSocials).length > 0
        ? {
            social_instagram: detectedSocials.instagram || client.social_instagram || null,
            social_linkedin: detectedSocials.linkedin || client.social_linkedin || null,
            social_facebook: detectedSocials.facebook || client.social_facebook || null,
            social_youtube: detectedSocials.youtube || client.social_youtube || null,
            social_tiktok: detectedSocials.tiktok || client.social_tiktok || null,
            social_twitter: detectedSocials.twitter || client.social_twitter || null,
            social_pinterest: detectedSocials.pinterest || client.social_pinterest || null,
            social_other: detectedSocials.other || client.social_other || null,
          }
        : {}

    // Auto-add segment from AI profile to client tags if not already
    // present. Normalises "Software House / Desenvolvimento de Produtos
    // Digitais" → ["Software House", "Desenvolvimento de Produtos Digitais"]
    const rawSegment = aiProfile.segment as string | undefined
    let tagsPatch: { tags?: string[] } = {}
    if (rawSegment) {
      const newSegments = rawSegment
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 30)
      const existing = client.tags ?? []
      const toAdd = newSegments.filter(
        (s) => !existing.some((e) => e.toLowerCase() === s.toLowerCase()),
      )
      if (toAdd.length > 0) tagsPatch = { tags: [...existing, ...toAdd] }
    }

    await fetch(`/api/admin/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis: aiProfile,
        website: analyzeUrl || client.website,
        ...socialPatch,
        ...tagsPatch,
      }),
    })
    setSavingAi(false)
    setEditingAi(false)
    setDetectedSocials({})
    onSaved()
  }

  return (
    <>
      {/* AI Profile card — always compact. Heavy content (long fields,
          IA analyzer, edit form) lives inside a Dialog opened via the
          Maximize2 button. This keeps the page layout stable: clicking
          'edit' or 'view full' no longer pushes everything below this
          card down. */}
      <Card className={cn('p-5', hasAiProfile && 'border-primary/30')}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <Bot className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            Perfil de IA
            {hasAiProfile && (
              <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                <Check size={10} /> Salvo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasAiProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAi(true)
                  setAiModalOpen(true)
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
              </Button>
            )}
            <IconButton
              icon={<Maximize2 className="h-4 w-4" />}
              label="Ver perfil completo"
              size="icon"
              onClick={() => {
                setEditingAi(false)
                setAiModalOpen(true)
              }}
            />
          </div>
        </div>

        {hasAiProfile ? (
          // Compact summary — uppercase label + value below. Same pattern
          // used by 'Sobre' card (sidebar) and 'Informações' inside
          // cliente detail. truncate keeps long values from overflowing;
          // full text is in the Dialog.
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {['segment', 'tone_of_voice', 'brand_personality', 'price_positioning']
              .filter((k) => aiProfile[k])
              .map((k) => (
                <div key={k} className="min-w-0">
                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {AI_FIELDS.find((f) => f.key === k)?.label}
                  </div>
                  <div className="truncate text-sm" title={String(aiProfile[k])}>
                    {String(aiProfile[k])}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 py-1">
            <p className="text-sm text-muted-foreground">
              Análise da marca pra usar em propostas e briefings — tom de voz,
              personalidade, posicionamento.
            </p>
            <Button onClick={() => setAiModalOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Configurar perfil
            </Button>
          </div>
        )}
      </Card>

      {/* AI Profile dialog — heavy view, holds the IA analyzer, the full
          grid of short fields, the long-text fields, detected socials
          banner, and the edit form. Opens via 'Editar' (jumps straight
          into edit mode) or via the expand IconButton (view mode). */}
      <Dialog
        open={aiModalOpen}
        onOpenChange={(open) => {
          setAiModalOpen(open)
          if (!open) {
            // Cancel any in-flight edit when dialog closes — same
            // behavior as the inline 'Cancelar' button used to have.
            if (editingAi && client.analysis) {
              setAiProfile(client.analysis as Record<string, string>)
            }
            setEditingAi(false)
          }
        }}
      >
        <DialogContent wide className="max-h-[88vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            <div className="text-lg font-bold tracking-tight">Perfil de IA</div>
            {hasAiProfile && (
              <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                <Check size={10} /> Salvo
              </span>
            )}
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            {client.company} · análise da marca usada como contexto pela IA ao
            redigir propostas, briefings e mensagens pra esse cliente.
          </p>

          {/* Analyzer */}
          <div className="mb-4 rounded-lg bg-muted/40 p-4">
            <div className="flex flex-col gap-2">
              <Input
                value={analyzeUrl}
                onChange={(e) => setAnalyzeUrl(e.target.value)}
                placeholder="URL do site (opcional)"
              />
              <textarea
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                placeholder="Informações extras sobre o cliente (opcional)"
                className="min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button onClick={analyzeWithAI} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Clock className="mr-1.5 h-4 w-4 animate-spin" />
                    Analisando com IA...
                  </>
                ) : hasAiProfile ? (
                  <>
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Re-analisar com IA
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Analisar com IA
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Detected socials banner */}
          {Object.keys(detectedSocials).length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
              <span className="text-xs font-medium text-primary">Redes detectadas:</span>
              {Object.entries(detectedSocials).map(([k, v]) =>
                v ? (
                  <a
                    key={k}
                    href={v}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs capitalize text-primary underline underline-offset-2 hover:text-primary"
                  >
                    {k}
                  </a>
                ) : null,
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                Serão salvas ao salvar o perfil
              </span>
            </div>
          )}

          {hasAiProfile && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {(() => {
                const short = AI_FIELDS.filter(
                  (f) => !f.long && (editingAi || aiProfile[f.key]),
                )
                return short.length > 0 ? (
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
                    {short.map((f) => (
                      <div key={f.key} className="min-w-0">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {f.label}
                        </div>
                        {editingAi ? (
                          <input
                            type="text"
                            value={aiProfile[f.key] ?? ''}
                            onChange={(e) =>
                              setAiProfile((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                            className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ) : (
                          <div className="break-words text-sm leading-relaxed">
                            {String(aiProfile[f.key] ?? '—')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
              {(() => {
                const long = AI_FIELDS.filter(
                  (f) => f.long && (editingAi || aiProfile[f.key]),
                )
                return long.length > 0 ? (
                  <div className="divide-y divide-border/60">
                    {long.map((f) => (
                      <div key={f.key} className="p-4">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {f.label}
                        </div>
                        {editingAi ? (
                          <textarea
                            value={aiProfile[f.key] ?? ''}
                            onChange={(e) =>
                              setAiProfile((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                            className="block min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {String(aiProfile[f.key])}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
              {editingAi && (
                <div className="flex gap-2 border-t border-border/60 bg-muted/20 px-4 py-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingAi(false)
                      if (client.analysis) {
                        setAiProfile(client.analysis as Record<string, string>)
                      }
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      await saveAiProfile()
                      // saveAiProfile flips editingAi off; close dialog so
                      // user lands back on the page.
                      setAiModalOpen(false)
                    }}
                    disabled={savingAi}
                    className="flex-1"
                  >
                    {savingAi ? (
                      'Salvando…'
                    ) : (
                      <>
                        <Save className="mr-1.5 h-4 w-4" />
                        Salvar
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
