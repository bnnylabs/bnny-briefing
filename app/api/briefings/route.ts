import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { generateSlug } from '@/lib/briefing-types'
import { sendBriefingToClient, sendWhatsApp } from '@/lib/email'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

function getBaseUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('briefings').select(`*, clients(*)`).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ briefings: data })
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


async function translatePrefilledToEN(prefilled: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Translate text string values that look like PT content (>20 chars, not multiselect options)
  const toTranslate: Record<string, string> = {}
  for (const [key, value] of Object.entries(prefilled)) {
    if (typeof value === 'string' && value.length > 20 && !value.includes('|')) {
      toTranslate[key] = value
    }
  }
  if (Object.keys(toTranslate).length === 0) return prefilled
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: `Translate these text values from Portuguese to natural English. Keep the same JSON keys. Return ONLY valid JSON, no extra text or explanation:
${JSON.stringify(toTranslate, null, 2)}` }]
    })
    const content = msg.content[0]
    if (content.type !== 'text') return prefilled
    const match = content.text.match(/\{[\s\S]*\}/)
    if (!match) return prefilled
    const translated = JSON.parse(match[0])
    return { ...prefilled, ...translated }
  } catch (e) {
    console.error('Translation failed:', e)
    return prefilled
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { client, briefingType, briefingTypeLabel, prefilledData, expiryDays, internalNotes, sendEmail, language } = body

  let clientId: string
  if (client.id) {
    clientId = client.id
    await supabaseAdmin.from('clients').update({
      name: client.name, company: client.company, website: client.website,
      email: client.email, phone: client.phone, analysis: client.analysis,
    }).eq('id', clientId)
  } else {
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients').insert({ name: client.name, company: client.company, website: client.website, email: client.email, phone: client.phone, analysis: client.analysis })
      .select().single()
    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
    clientId = newClient.id
  }

  const slug = generateSlug(client.company)
  const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 86400000).toISOString() : null
  const baseUrl = getBaseUrl(req)
  const link = `${baseUrl}/${slug}`

  // Try inserting with language field (requires SQL migration)
  // Falls back without language if column doesn't exist yet
  let briefing, briefingError
  // Translate prefilled data to English when briefing language is EN
  let finalPrefilledData = prefilledData || {}
  if (language === 'en-US' && Object.keys(finalPrefilledData).length > 0) {
    finalPrefilledData = await translatePrefilledToEN(finalPrefilledData)
  }

  const briefingPayload = {
    client_id: clientId, slug, type: briefingType, type_label: briefingTypeLabel,
    status: 'enviado', prefilled_data: finalPrefilledData,
    internal_notes: internalNotes || null, expires_at: expiresAt,
  }
  const resultWithLang = await supabaseAdmin
    .from('briefings').insert({ ...briefingPayload, language: language || 'pt-BR' }).select().single()
  if (resultWithLang.error?.message?.includes('column') || resultWithLang.error?.code === '42703') {
    // Column doesn't exist yet — insert without language
    const resultNoLang = await supabaseAdmin.from('briefings').insert(briefingPayload).select().single()
    briefing = resultNoLang.data; briefingError = resultNoLang.error
  } else {
    briefing = resultWithLang.data; briefingError = resultWithLang.error
  }

  if (briefingError) return NextResponse.json({ error: briefingError.message }, { status: 500 })

  // Build recipients list and send emails
  const recipients: Array<{ email: string; name: string; role: 'primary' | 'cc' }> = []
  let emailSent = false

  if (sendEmail !== false && client.email) {
    const emailResult = await sendBriefingToClient({
      clientName: client.name,
      clientEmail: client.email,
      company: client.company,
      typeLabel: briefingTypeLabel,
      link,
      language: language || 'pt-BR',
    })
    emailSent = emailResult.ok

    recipients.push({ email: client.email, name: client.name, role: 'primary' })

    // Log primary send
    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id,
      type: 'email_client',
      status: emailResult.ok ? 'sent' : 'failed',
      details: { to: client.email, name: client.name, role: 'primary', link }
    }) } catch(_e) {}

    // Fetch CC contacts and send to each
    const { data: ccContacts } = await supabaseAdmin
      .from('client_contacts')
      .select('name, email, language')
      .eq('client_id', clientId)
      .eq('receives_copies', true)

    for (const cc of (ccContacts ?? []).filter(c => c.email)) {
      const ccResult = await sendBriefingToClient({
        clientName: cc.name,
        clientEmail: cc.email!,
        company: client.company,
        typeLabel: briefingTypeLabel,
        link,
        language: cc.language || language || 'pt-BR',
      })
      recipients.push({ email: cc.email!, name: cc.name, role: 'cc' })
      try { await supabaseAdmin.from('notifications').insert({
        briefing_id: briefing.id,
        type: 'email_client',
        status: ccResult.ok ? 'sent' : 'failed',
        details: { to: cc.email, name: cc.name, role: 'cc', link }
      }) } catch(_e) {}
    }

    // Persist recipients snapshot on the briefing row
    try { await supabaseAdmin.from('briefings')
      .update({ recipients })
      .eq('id', briefing.id) } catch(_e) {}

    // WhatsApp to admin
    await sendWhatsApp(`📨 Novo briefing enviado!\nEmpresa: ${client.company}\nTipo: ${briefingTypeLabel}\nDestinatários: ${recipients.length}\nLink: ${link}`)
  }

  return NextResponse.json({ briefing, link, emailSent })
}
