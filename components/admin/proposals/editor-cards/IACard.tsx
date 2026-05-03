'use client'

/**
 * IA card — collapsible card que dispara a regeneração da proposta com IA.
 *
 * Usa dados cadastrais do cliente automaticamente (site, redes, perfil de
 * IA salvo no `clients.ai_profile`). O operador pode adicionar:
 *   - Contexto extra (notas de reunião, transcrição, detalhes)
 *   - Override do destinatário ("Para quem é a abertura?") — útil quando
 *     a proposta vai pra alguém que não é o contato principal cadastrado;
 *     sem persistência, afeta só esta geração.
 *   - **Upload de TXT/PDF (Fase H, v0.10.106+)** — anexa briefing,
 *     transcrição, ata, contrato. Dois modos:
 *       Texto (grátis): pdf-parse extrai texto plano server-side
 *       Visual (custa): Claude lê PDF nativamente — layout, tabelas, scans
 *     Operador escolhe explicitamente; copy explica trade-off no card.
 *
 * Auto-collapsa após sucesso — operador raramente precisa do card aberto
 * depois que a IA fez seu trabalho.
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97).
 */

import { useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Paperclip,
  FileText,
  X as XIcon,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProposalWithClient } from '@/lib/proposal-types'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPT_ATTR = '.txt,.pdf,text/plain,application/pdf'

type UploadMode = 'text' | 'visual'

type AttachmentState =
  | { kind: 'idle' }
  | { kind: 'parsing'; fileName: string }
  | {
      kind: 'text'
      fileName: string
      fileSize: number
      extractedText: string
      charCount: number
    }
  | {
      kind: 'visual'
      fileName: string
      fileSize: number
      base64: string
    }
  | { kind: 'error'; fileName: string; message: string }

export function IACard({
  proposal,
  onPersonalize,
}: {
  proposal: ProposalWithClient
  onPersonalize: (args: {
    context: string
    addresseeName: string
    pdfBase64?: string
    pdfFilename?: string
  }) => Promise<void>
}) {
  const [context, setContext] = useState('')
  const [addresseeName, setAddresseeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('text')
  const [attachment, setAttachment] = useState<AttachmentState>({ kind: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Always allow regen when there's a client (auto-context from cadastrado data)
  // — context typed by owner is just a bonus.
  const canSubmit =
    !loading && !!proposal.client_id && attachment.kind !== 'parsing'

  const resetAttachment = () => {
    setAttachment({ kind: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /**
   * Lê o arquivo escolhido. Comportamento depende do modo:
   *   - 'text': passa pelo /api/proposals/extract-text (TXT trivial,
   *     PDF via pdf-parse). Devolve texto plano.
   *   - 'visual': se for TXT, faz extração mesmo (não faz sentido mandar
   *     TXT como document part). Se for PDF, lê como base64 e guarda
   *     pra mandar no submit.
   */
  const handleFileChosen = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setAttachment({
        kind: 'error',
        fileName: file.name,
        message: `Arquivo maior que ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      })
      return
    }

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isTxt =
      file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')

    if (!isPdf && !isTxt) {
      setAttachment({
        kind: 'error',
        fileName: file.name,
        message: 'Apenas TXT e PDF são suportados',
      })
      return
    }

    // Modo visual + PDF = base64 pra mandar como document part
    if (uploadMode === 'visual' && isPdf) {
      setAttachment({ kind: 'parsing', fileName: file.name })
      try {
        const base64 = await fileToBase64(file)
        setAttachment({
          kind: 'visual',
          fileName: file.name,
          fileSize: file.size,
          base64,
        })
      } catch {
        setAttachment({
          kind: 'error',
          fileName: file.name,
          message: 'Erro ao ler o arquivo',
        })
      }
      return
    }

    // Modo texto (ou visual com TXT, que extraímos mesmo): server-side
    setAttachment({ kind: 'parsing', fileName: file.name })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/proposals/extract-text', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json()) as
        | { text: string; charCount: number }
        | { error: string }

      if (!res.ok || 'error' in data) {
        const message = 'error' in data ? data.error : 'Falha ao extrair'
        setAttachment({ kind: 'error', fileName: file.name, message })
        return
      }

      if (!data.text || data.charCount < 20) {
        setAttachment({
          kind: 'error',
          fileName: file.name,
          message:
            'Não consegui extrair texto. Pode ser PDF scaneado — tente o modo "Visual com IA".',
        })
        return
      }

      setAttachment({
        kind: 'text',
        fileName: file.name,
        fileSize: file.size,
        extractedText: data.text,
        charCount: data.charCount,
      })
    } catch (err) {
      setAttachment({
        kind: 'error',
        fileName: file.name,
        message: err instanceof Error ? err.message : 'Erro ao processar',
      })
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      // Concatena texto extraído ao context. Modo visual envia base64
      // separado pra Claude processar como document part.
      let finalContext = context.trim()
      let pdfBase64: string | undefined
      let pdfFilename: string | undefined

      if (attachment.kind === 'text') {
        const header = `--- Conteúdo de ${attachment.fileName} ---`
        finalContext = finalContext
          ? `${finalContext}\n\n${header}\n${attachment.extractedText}`
          : `${header}\n${attachment.extractedText}`
      } else if (attachment.kind === 'visual') {
        pdfBase64 = attachment.base64
        pdfFilename = attachment.fileName
      }

      await onPersonalize({
        context: finalContext,
        addresseeName,
        pdfBase64,
        pdfFilename,
      })
      setContext('')
      setAddresseeName('')
      resetAttachment()
      // Auto-collapse after success — owner doesn't need to keep the card
      // open after the AI did its job.
      setExpanded(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      {/* Clickable header — toggles the card open/closed */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-3 text-left',
          expanded ? 'mb-4' : 'mb-0',
        )}
      >
        <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Personalizar com IA
        </div>
        <div className="flex items-center gap-2">
          {!expanded && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Reescrever abertura e fases
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A IA usa os dados do cliente automaticamente (site, redes, perfil
            de IA salvo). Adicione contexto extra abaixo se quiser — notas da
            reunião, transcrição, detalhes específicos.
          </p>

          {/* Para quem é a abertura — override do contato primário pra
              casos onde a proposta vai pra alguém específico que não é
              (ou não deveria ser) o contato principal cadastrado. Sem
              persistência; só afeta esta geração. */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Para quem é a abertura? (opcional)
            </label>
            <input
              type="text"
              value={addresseeName}
              onChange={(e) => setAddresseeName(e.target.value)}
              placeholder="Ex: Gabriel — usa o contato principal se vazio"
              className={cn(
                'flex w-full rounded-md border border-border bg-secondary px-3 py-2',
                'text-sm text-foreground placeholder:text-muted-foreground/50',
                'focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all',
              )}
            />
          </div>

          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Notas, transcrição, contexto adicional (opcional)…"
            rows={3}
            className={cn(
              'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
              'text-sm text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all',
            )}
          />

          {/* Anexar arquivo — Fase H. Mode picker explica trade-off. */}
          <UploadSection
            mode={uploadMode}
            onModeChange={setUploadMode}
            attachment={attachment}
            onChooseFile={() => fileInputRef.current?.click()}
            onRemove={resetAttachment}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileChosen(file)
            }}
          />

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Personalizando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Personalizar
                </>
              )}
            </Button>
          </div>

          {!proposal.template_id && (
            <p className="text-[11px] text-warning">
              Esta proposta não tem modelo. A IA vai gerar do zero a partir
              do contexto e dos dados do cliente.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────
 * UploadSection — UI do upload de TXT/PDF + escolha de modo.
 * Estados: idle (sem arquivo), parsing (loading), text/visual (anexado),
 * error. Cada estado tem affordance própria. v0.10.106+.
 * ──────────────────────────────────────────────────────────────────── */
function UploadSection({
  mode,
  onModeChange,
  attachment,
  onChooseFile,
  onRemove,
}: {
  mode: UploadMode
  onModeChange: (m: UploadMode) => void
  attachment: AttachmentState
  onChooseFile: () => void
  onRemove: () => void
}) {
  const showAttached = attachment.kind === 'text' || attachment.kind === 'visual'

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Anexar arquivo (opcional)
        </span>
      </div>

      {/* Mode picker — sempre visível, exceto enquanto há anexo válido
          (trocar modo com anexo seria confuso; remova primeiro). */}
      {!showAttached && (
        <>
          <ModePicker
            mode={mode}
            onChange={onModeChange}
            disabled={attachment.kind === 'parsing'}
          />
          <ModeExplanation mode={mode} />
        </>
      )}

      {/* Estados do anexo */}
      {attachment.kind === 'idle' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onChooseFile}
          className="w-full"
        >
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          Escolher TXT ou PDF
        </Button>
      )}

      {attachment.kind === 'parsing' && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="truncate">Lendo {attachment.fileName}…</span>
        </div>
      )}

      {attachment.kind === 'text' && (
        <AttachedCard
          icon={<FileText className="h-3.5 w-3.5 text-success" />}
          fileName={attachment.fileName}
          detail={`${formatNumber(attachment.charCount)} caracteres extraídos · grátis`}
          onRemove={onRemove}
        />
      )}

      {attachment.kind === 'visual' && (
        <AttachedCard
          icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
          fileName={attachment.fileName}
          detail={`Visual · IA processa o PDF inteiro (~${estimateCost(attachment.fileSize)})`}
          onRemove={onRemove}
        />
      )}

      {attachment.kind === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">
                {attachment.fileName}
              </div>
              <div className="text-muted-foreground">{attachment.message}</div>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remover"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onChooseFile}
            className="w-full"
          >
            Tentar outro arquivo
          </Button>
        </div>
      )}
    </div>
  )
}

function ModePicker({
  mode,
  onChange,
  disabled,
}: {
  mode: UploadMode
  onChange: (m: UploadMode) => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <ModeButton
        active={mode === 'text'}
        disabled={disabled}
        onClick={() => onChange('text')}
        title="Texto"
        subtitle="grátis"
      />
      <ModeButton
        active={mode === 'visual'}
        disabled={disabled}
        onClick={() => onChange('visual')}
        title="Visual com IA"
        subtitle="custa"
      />
    </div>
  )
}

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-left transition-all',
        active
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-background/40 hover:border-border/80',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-xs font-semibold', active && 'text-primary')}>
          {title}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {subtitle}
        </span>
      </div>
    </button>
  )
}

function ModeExplanation({ mode }: { mode: UploadMode }) {
  if (mode === 'text') {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Extrai apenas o{' '}
        <strong className="font-semibold text-foreground">texto</strong> do
        arquivo. Funciona pra TXT e PDFs digitais (transcrições, notas,
        documentos com texto selecionável). Sem custo.
      </p>
    )
  }
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      A IA{' '}
      <strong className="font-semibold text-foreground">
        lê o PDF visualmente
      </strong>{' '}
      — entende layout, tabelas e até PDFs scaneados/imagens. Use pra
      briefings com diagramação, contratos com tabelas, decks. Custo
      proporcional ao tamanho do PDF.
    </p>
  )
}

function AttachedCard({
  icon,
  fileName,
  detail,
  onRemove,
}: {
  icon: React.ReactNode
  fileName: string
  detail: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{fileName}</div>
        <div className="text-muted-foreground">{detail}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Remover anexo"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ─── Utils ──────────────────────────────────────────────────────── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('FileReader devolveu tipo inesperado'))
        return
      }
      // result vem como "data:application/pdf;base64,XXXX"
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

/**
 * Estimativa rouge de custo da chamada visual. PDFs viram ~1.5k tokens
 * por 100kb no Anthropic SDK. Haiku 4.5 = $1/MTok input. Mostra em USD
 * com 4 decimais quando < $0.01, senão 2.
 */
function estimateCost(fileSizeBytes: number): string {
  const tokens = (fileSizeBytes / 100_000) * 1500
  const dollars = (tokens / 1_000_000) * 1 // $1/MTok input pra haiku-4-5
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(2)}`
}
