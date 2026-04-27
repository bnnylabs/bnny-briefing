/**
 * /api/admin/email-templates/test-send
 *
 * POST — sends a real email to the configured notification_email
 * (settings table) using the current template content + sample data.
 * Accepts an optional `override` object so the admin can test their
 * unsaved draft without having to save first.
 *
 * Logs to the `notifications` table with type='email_test' so there's
 * an audit trail of every test send (useful for debugging deliverability).
 *
 * Returns { ok, resendId?, to } on success or { error } on failure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'
import { composePreview } from '@/lib/email'
import {
  TEMPLATE_LANGUAGES,
  TEMPLATE_TYPES,
  type TemplateLanguage,
  type TemplateType,
} from '@/lib/email-defaults'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

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

  // Resolve notification_email from settings — this is where the test goes.
  const { data: settingsRows } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['notification_email'])

  const settings: Record<string, string> = {}
  settingsRows?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

  const to = settings.notification_email
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'no_notification_email' }, { status: 422 })
  }

  // Clean override — same logic as preview route.
  let cleanOverride: Record<string, string> | undefined
  if (override && typeof override === 'object') {
    cleanOverride = {}
    for (const k of ['subject', 'preheader', 'title', 'body_markdown', 'cta_text']) {
      const v = (override as Record<string, unknown>)[k]
      if (typeof v === 'string') cleanOverride[k] = v
    }
  }

  // Compose using the exact same preview pipeline — sample vars + sample
  // blocks — so what arrives in the inbox is identical to the editor preview.
  const composed = await composePreview({
    type: type as TemplateType,
    language: language as TemplateLanguage,
    override: cleanOverride,
  })

  // Tag the subject so the admin recognises it as a test in their inbox.
  const taggedSubject =
    language === 'en-US'
      ? `[TEST] ${composed.subject}`
      : `[TESTE] ${composed.subject}`

  const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  let resendId: string | undefined
  let sendOk = false

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: taggedSubject,
      html: composed.html,
      text: composed.text,
    })
    sendOk = !result.error
    resendId = result.data?.id
  } catch (err) {
    console.error('test-send failed:', err)
  }

  // Log regardless of success — useful to see "attempted but failed" in
  // the notifications table when debugging Resend config issues.
  try {
    await supabaseAdmin.from('notifications').insert({
      briefing_id: null,
      type: 'email_test',
      status: sendOk ? 'sent' : 'failed',
      details: {
        to,
        template_type: type,
        language,
        resend_id: resendId ?? null,
        subject: taggedSubject,
        had_override: !!cleanOverride,
      },
    })
  } catch (_e) {
    // Logging failure should never surface to the user.
  }

  if (!sendOk) {
    return NextResponse.json({ error: 'send_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resendId, to })
}
