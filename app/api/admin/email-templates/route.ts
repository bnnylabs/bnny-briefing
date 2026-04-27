/**
 * /api/admin/email-templates
 *
 * GET    — returns every (type, language) resolved template. Missing
 *          DB rows resolve to the default with `is_default: true` so
 *          the editor UI can show a "default" badge.
 * PUT    — upserts a single (type, language) override. Body shape
 *          mirrors EmailTemplateContent. Saving overwrites whatever
 *          was in the DB; clearing a field to its default is done via
 *          DELETE, not PUT-with-defaults.
 * DELETE — removes the override row, falling back to the default. Used
 *          by the "Restaurar padrão" button.
 *
 * Auth: same cookie/password gate every other admin route uses.
 * Cache: each write invalidates the loader's in-process cache so
 * subsequent sends pick up the new content within milliseconds rather
 * than waiting out the 30s TTL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  TEMPLATE_LANGUAGES,
  TEMPLATE_TYPES,
  type TemplateLanguage,
  type TemplateType,
} from '@/lib/email-defaults'
import { getAllTemplates, invalidateTemplateCache } from '@/lib/email-templates'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

const VALID_TYPES = new Set<string>(TEMPLATE_TYPES)
const VALID_LANGS = new Set<string>(TEMPLATE_LANGUAGES)

function isValidPair(type: unknown, language: unknown): type is TemplateType {
  return (
    typeof type === 'string' &&
    typeof language === 'string' &&
    VALID_TYPES.has(type) &&
    VALID_LANGS.has(language)
  )
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await getAllTemplates()
  return NextResponse.json({ templates })
}

export async function PUT(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { type, language, subject, preheader, title, body_markdown, cta_text } =
    body as Record<string, unknown>

  if (!isValidPair(type, language)) {
    return NextResponse.json({ error: 'invalid_type_or_language' }, { status: 400 })
  }

  // Light validation on the editable fields. Keep it permissive — the
  // admin is trusted; the goal is to fail fast on accidentally-sending
  // numbers or arrays from a buggy form, not to police content.
  const fields = { subject, preheader, title, body_markdown, cta_text }
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && typeof v !== 'string') {
      return NextResponse.json({ error: `invalid_${k}` }, { status: 400 })
    }
  }

  // Required fields can't be empty after trim — subject/title/body all
  // need values for the email to make sense. Preheader and cta_text
  // can be empty (preheader is optional inbox preview text; cta_text
  // is allowed empty for the confirmation template when no edit link
  // is available).
  const subjectStr = (subject as string | undefined) ?? ''
  const titleStr = (title as string | undefined) ?? ''
  const bodyStr = (body_markdown as string | undefined) ?? ''
  if (!subjectStr.trim() || !titleStr.trim() || !bodyStr.trim()) {
    return NextResponse.json({ error: 'subject_title_body_required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('email_templates').upsert(
    {
      type: type as TemplateType,
      language: language as TemplateLanguage,
      subject: subjectStr,
      preheader: ((preheader as string | undefined) ?? '').trim()
        ? (preheader as string)
        : '',
      title: titleStr,
      body_markdown: bodyStr,
      cta_text: (cta_text as string | undefined) ?? '',
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'type,language' },
  )

  if (error) {
    console.error('email_templates upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateTemplateCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const language = url.searchParams.get('language')

  if (!isValidPair(type, language)) {
    return NextResponse.json({ error: 'invalid_type_or_language' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('type', type)
    .eq('language', language)

  if (error) {
    console.error('email_templates delete failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateTemplateCache()
  return NextResponse.json({ ok: true })
}
