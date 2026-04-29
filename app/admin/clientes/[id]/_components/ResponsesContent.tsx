'use client'

import type { ReactNode } from 'react'
import { Paperclip, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Renders a briefing's response payload inside the responses modal,
 * grouping uploaded files at the top with a "Download all as ZIP" CTA
 * and rendering each text/array answer below in compact cards.
 *
 * Lives outside the page component because:
 *   - It has its own local state (none, but the ZIP import is lazy)
 *   - Its render logic is dense (file-detection heuristic, label maps,
 *     short-vs-long display variants) and was already a self-contained
 *     function inside the page
 *   - It's reused as a child of two distinct parents: the responses
 *     modal and the diff-mode toggle. Extracting clarifies the
 *     contract — what data goes in, what UI comes out.
 *
 * The file-detection heuristic checks both the field name (`/arquivo|
 * logo|referencia|anexo|upload|files/i`) and the value shape (array
 * of objects with a `url` prop). Either match treats the field as
 * file-bearing.
 */

export interface FileEntry {
  url: string
  name: string
  type?: string
  size?: number
}

export interface ResponsesContentProps {
  responses: Record<string, unknown>
  language?: string
  companyName: string
  /** Renders a file/array-of-files value as JSX. Caller controls layout. */
  renderFileValue: (v: unknown) => ReactNode
  labelMapPT: Record<string, string>
  labelMapEN: Record<string, string>
}

export function ResponsesContent({
  responses,
  language,
  companyName,
  renderFileValue,
  labelMapPT,
  labelMapEN,
}: ResponsesContentProps) {
  const allFiles: FileEntry[] = []
  Object.values(responses).forEach((value) => {
    if (Array.isArray(value)) {
      ;(value as FileEntry[]).forEach((f) => {
        if (f?.name && f.url?.startsWith('http')) allFiles.push(f)
      })
    }
  })
  const imageFiles = allFiles.filter(
    (f) =>
      f.type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name),
  )
  const otherFiles = allFiles.filter(
    (f) =>
      !f.type?.startsWith('image/') &&
      !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name),
  )
  const labelMap = language === 'en-US' ? labelMapEN : labelMapPT

  async function handleDownloadAll() {
    const { downloadAsZip } = await import('@/lib/download-zip')
    await downloadAsZip(allFiles, `${companyName} - arquivos.zip`)
  }

  return (
    <>
      {allFiles.length > 0 && (
        <Card className="mb-3 flex items-center gap-3 bg-muted/50 p-3">
          <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {allFiles.length} {allFiles.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
              {imageFiles.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {imageFiles.length} {imageFiles.length === 1 ? 'imagem' : 'imagens'}
                  {otherFiles.length > 0 &&
                    `, ${otherFiles.length} ${otherFiles.length === 1 ? 'documento' : 'documentos'}`}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleDownloadAll} className="shrink-0">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar ZIP
          </Button>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {Object.entries(responses)
          .filter(([, v]) => v)
          .map(([key, value]) => {
            const isFileField =
              /arquivo|logo|referencia|anexo|upload|files/i.test(key) ||
              (Array.isArray(value) &&
                value.length > 0 &&
                typeof value[0] === 'object' &&
                value[0] !== null &&
                'url' in (value[0] as object))
            const displayValue = isFileField
              ? ''
              : Array.isArray(value)
                ? (value as string[]).join(', ')
                : String(value)
            const isShort = !isFileField && displayValue.length < 60
            return (
              <div key={key} className="overflow-hidden rounded-lg border border-border">
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 bg-muted/40 px-3.5 py-2',
                    !(isShort && !isFileField) && 'border-b border-border',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {isFileField && <Paperclip className="h-3 w-3" />}
                    {labelMap[key] || key.replace(/_/g, ' ')}
                  </span>
                  {isShort && !isFileField && (
                    <span className="text-sm font-semibold text-foreground">{displayValue}</span>
                  )}
                </div>
                {(!isShort || isFileField) && (
                  <div className="bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground">
                    {isFileField ? (
                      renderFileValue(value)
                    ) : (
                      <span className="whitespace-pre-wrap">{displayValue}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </>
  )
}
