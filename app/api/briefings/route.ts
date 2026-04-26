import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { client, briefingType, briefingTypeLabel, prefilledData, expiryDays, internalNotes, sendEmail } = body

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

  const { data: briefing, error: briefingError } = await supabaseAdmin
    .from('briefings').insert({
      client_id: clientId, slug, type: briefingType, type_label: briefingTypeLabel,
      status: 'enviado', prefilled_data: prefilledData || {},
      internal_notes: internalNotes || null, expires_at: expiresAt,
    }).select().single()

  if (briefingError) return NextResponse.json({ error: briefingError.message }, { status: 500 })

  // Send email to client if requested and email exists
  let emailSent = false
  if (sendEmail !== false && client.email) {
    const emailResult = await sendBriefingToClient({
      clientName: client.name,
      clientEmail: client.email,
      company: client.company,
      typeLabel: briefingTypeLabel,
      link,
    })
    emailSent = emailResult.ok

    // Log notification
    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id,
      type: 'email_client',
      status: emailResult.ok ? 'sent' : 'failed',
      details: { to: client.email, link }
    }) } catch(_e) {}

    // WhatsApp to admin
    await sendWhatsApp(`📨 Novo briefing enviado!\nEmpresa: ${client.company}\nTipo: ${briefingTypeLabel}\nLink: ${link}`)
  }

  return NextResponse.json({ briefing, link, emailSent })
}
