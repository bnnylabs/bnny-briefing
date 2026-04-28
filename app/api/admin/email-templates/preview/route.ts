/**
 * /api/admin/email-templates/preview
 *
 * POST — renders a fully-composed preview of an email template using
 * sample data, with the admin's unsaved draft fields overriding the
 * resolved template. The editor calls this on each (debounced) change
 * and pipes the response.html into an iframe srcdoc.
 *
 * Returns the same shape composeEmail produces: html, subject,
 * preheader, title, plus the resolved CTA text/href so the editor can
 * surface them outside the iframe (e.g., in the "Subject" preview
 * row above the iframe).
 */

import { NextRequest, NextResponse } from 'next/server'
import { composePreview } from '@/lib/email'
import {
  TEMPLATE_LANGUAGES,
  TEMPLATE_TYPES,
  type TemplateLanguage,
  type TemplateType,
} from '@/lib/email-defaults'
import { isAuthed } from '@/lib/auth'

const VALID_TYPES = new Set<string>(TEMPLATE_TYPES)
const VALID_LANGS = new Set<string>(TEMPLATE_LANGUAGES)

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { type, language, override } = body as Record<string, unknown>

  if (
    typeof type !== 'string' ||
    typeof language !== 'string' ||
    !VALID_TYPES.has(type) ||
    !VALID_LANGS.has(language)
  ) {
    return NextResponse.json({ error: 'invalid_type_or_language' }, { status: 400 })
  }

  // Override is optional — when absent the preview shows the saved/
  // default copy. When present, individual fields override per
  // composeEmail's contract; missing fields fall through to the DB
  // row or default.
  let cleanOverride: Record<string, string> | undefined
  if (override && typeof override === 'object') {
    cleanOverride = {}
    for (const k of ['subject', 'preheader', 'title', 'body_markdown', 'cta_text']) {
      const v = (override as Record<string, unknown>)[k]
      if (typeof v === 'string') cleanOverride[k] = v
    }
  }

  const composed = await composePreview({
    type: type as TemplateType,
    language: language as TemplateLanguage,
    override: cleanOverride,
  })

  return NextResponse.json({
    html: composed.html,
    subject: composed.subject,
    preheader: composed.preheader,
    title: composed.title,
    ctaText: composed.ctaText ?? null,
    ctaHref: composed.ctaHref ?? null,
  })
}
