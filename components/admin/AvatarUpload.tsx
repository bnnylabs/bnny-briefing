'use client'

import * as React from 'react'
import Image from 'next/image'
import { Camera, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  /** Current photo URL — null/undefined renders initials */
  url?: string | null
  /** Name used to generate initials fallback */
  name: string
  /** Avatar size in px — controls h/w and font size */
  size?: 32 | 36 | 48
  /** Shape: square-ish rounded-lg (default) or circle rounded-full */
  shape?: 'rounded' | 'circle'
  /** POST endpoint for file upload — receives FormData with 'file' key */
  uploadUrl?: string
  /** DELETE endpoint to clear avatar */
  deleteUrl?: string
  /** Callback after successful upload */
  onUploaded?: (url: string) => void
  /** Callback after delete */
  onDeleted?: () => void
  /** If false, hide the upload overlay (read-only mode) */
  editable?: boolean
  className?: string
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIZE_CLASSES: Record<number, { container: string; text: string }> = {
  32: { container: 'h-8 w-8',   text: 'text-[11px]' },
  36: { container: 'h-9 w-9',   text: 'text-xs' },
  48: { container: 'h-12 w-12', text: 'text-sm' },
}

export function AvatarUpload({
  url,
  name,
  size = 36,
  shape = 'rounded',
  uploadUrl,
  deleteUrl,
  onUploaded,
  onDeleted,
  editable = true,
  className,
}: AvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [localUrl, setLocalUrl] = React.useState<string | null | undefined>(url)

  React.useEffect(() => { setLocalUrl(url) }, [url])

  const sizes = SIZE_CLASSES[size] ?? SIZE_CLASSES[36]
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg'
  const initials = getInitials(name)
  const hasImage = !!localUrl

  async function handleFile(file: File) {
    if (!uploadUrl) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(uploadUrl, { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const d = await res.json()
      setLocalUrl(d.url)
      onUploaded?.(d.url)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!deleteUrl) return
    setUploading(true)
    await fetch(deleteUrl, { method: 'DELETE' })
    setUploading(false)
    setLocalUrl(null)
    onDeleted?.()
  }

  return (
    <div className={cn('group relative shrink-0 select-none', sizes.container, className)}>
      {/* Avatar display */}
      <div className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden font-semibold',
        radius,
        hasImage ? 'bg-transparent' : 'bg-muted text-muted-foreground',
        sizes.text,
      )}>
        {hasImage ? (
          // Parent <div> is fixed-sized (sizes.container) so 'fill' is
          // the right choice — gives us responsive optimization without
          // having to thread numeric width/height through the size map.
          // 'unoptimized' for blob URLs (preview right after upload),
          // since next/image's optimizer can't fetch them.
          localUrl!.startsWith('blob:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={localUrl!} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Image
              src={localUrl!}
              alt={name}
              fill
              className="object-cover"
              sizes={`${size}px`}
            />
          )
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Upload overlay — only when editable */}
      {editable && uploadUrl && (
        <>
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            title="Clique para adicionar foto"
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-all',
              radius,
              uploading
                ? 'cursor-wait bg-black/40 opacity-100'
                : hasImage
                  ? 'cursor-pointer bg-black/0 opacity-0 hover:bg-black/40 hover:opacity-100'
                  : 'cursor-pointer bg-black/0 opacity-0 hover:bg-black/30 hover:opacity-100',
            )}
          >
            {(uploading || hasImage) && (
              <Camera
                size={size === 32 ? 12 : size === 36 ? 13 : 16}
                className="text-white drop-shadow"
              />
            )}
          </button>

          {/* Persistent camera badge — bottom-right, only when no image */}
          {!hasImage && !uploading && (
            <span className={cn(
              'pointer-events-none absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground',
              size === 48 ? 'h-5 w-5' : 'h-4 w-4',
            )}>
              <Camera size={size === 48 ? 10 : 8} />
            </span>
          )}

          {/* Remove button — top-right corner, only when has image */}
          {hasImage && deleteUrl && !uploading && (
            <button
              type="button"
              onClick={handleDelete}
              title="Remover foto"
              className={cn(
                'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100',
              )}
            >
              <X size={9} />
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </>
      )}
    </div>
  )
}
