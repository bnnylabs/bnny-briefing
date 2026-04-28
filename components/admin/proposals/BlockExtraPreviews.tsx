import { FileText, Paperclip } from 'lucide-react'
import { ProposalMarkdown } from '@/lib/proposal-markdown'
import type {
  BlockContentAttachments,
  BlockContentCustom,
  BlockContentNextSteps,
  BlockContentTerms,
} from '@/lib/proposal-types'

/** Termos & Condições — markdown formatado como prosa com subtítulos. */
export function TermsPreview({ content }: { content: BlockContentTerms }) {
  const md = content.body_markdown?.trim() ?? ''
  if (!md) return null
  return <ProposalMarkdown source={md} />
}

/** Próximos passos — lista numerada, monoespaçada nos números. */
export function NextStepsPreview({ content }: { content: BlockContentNextSteps }) {
  const items = (content.items ?? []).filter((i) => i?.trim())
  if (items.length === 0) return null
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="font-mono text-xs tabular-nums text-muted-foreground/70 pt-0.5 shrink-0">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-sm leading-relaxed text-foreground/85">{item}</span>
        </li>
      ))}
    </ol>
  )
}

/** Bloco livre — título opcional + corpo markdown. */
export function CustomPreview({ content }: { content: BlockContentCustom }) {
  const title = content.title?.trim()
  const body = content.body_markdown?.trim()
  if (!title && !body) return null
  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
      )}
      {body && <ProposalMarkdown source={body} />}
    </div>
  )
}

/** Anexos — lista de arquivos clicáveis. */
export function AttachmentsPreview({ content }: { content: BlockContentAttachments }) {
  const files = (content.files ?? []).filter((f) => f?.url)
  if (files.length === 0) return null
  return (
    <div className="space-y-2">
      {files.map((file, i) => (
        <a
          key={i}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50"
        >
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate font-medium">{file.name || 'Arquivo'}</span>
          <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        </a>
      ))}
    </div>
  )
}
