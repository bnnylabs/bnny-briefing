import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const includeArchived = url.searchParams.get('archived') === 'true'
  const statusFilter = url.searchParams.get('status') // comma-separated

  let query = supabaseAdmin
    .from('clients')
    .select('*')
    .order('is_starred', { ascending: false })
    .order('created_at', { ascending: false })

  // By default exclude archived clients — they're soft-deleted
  if (!includeArchived) {
    query = query.is('archived_at', null)
  }

  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(Boolean)
    if (statuses.length > 0) query = query.in('status', statuses)
  }

  const { data: clients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Briefing stats per client
  const { data: briefings } = await supabaseAdmin
    .from('briefings')
    .select('client_id, status, created_at, completed_at')

  const statsMap: Record<string, { total: number; concluido: number; last_at: string | null }> = {}
  for (const b of briefings ?? []) {
    if (!statsMap[b.client_id]) statsMap[b.client_id] = { total: 0, concluido: 0, last_at: null }
    statsMap[b.client_id].total++
    if (b.status === 'concluido') statsMap[b.client_id].concluido++
    if (!statsMap[b.client_id].last_at || b.created_at > statsMap[b.client_id].last_at!) {
      statsMap[b.client_id].last_at = b.created_at
    }
  }

  const result = (clients ?? []).map((c) => ({
    ...c,
    stats: statsMap[c.id] ?? { total: 0, concluido: 0, last_at: null },
  }))

  return NextResponse.json({ clients: result })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  const { name, company, email, phone, website, social_links } = body

  if (!name?.trim() || !company?.trim()) {
    return NextResponse.json({ error: 'name_and_company_required' }, { status: 400 })
  }

  // Flatten social_links into columns if provided (returned by analyze API)
  const socials = social_links
    ? {
        social_instagram: social_links.instagram ?? null,
        social_linkedin: social_links.linkedin ?? null,
        social_facebook: social_links.facebook ?? null,
        social_youtube: social_links.youtube ?? null,
        social_tiktok: social_links.tiktok ?? null,
        social_twitter: social_links.twitter ?? null,
        social_pinterest: social_links.pinterest ?? null,
        social_other: social_links.other ?? null,
      }
    : {}

  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name: name.trim(),
      company: company.trim(),
      email: email?.trim() ?? '',
      phone: phone?.trim() ?? null,
      website: website?.trim() ?? null,
      ...socials,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create the primary contact from the main client fields
  if (email?.trim()) {
    await supabaseAdmin.from('client_contacts').insert({
      client_id: client.id,
      name: name.trim(),
      email: email.trim(),
      whatsapp: phone?.trim() ?? null,
      is_primary: true,
      language: 'pt-BR',
    })
  }

  return NextResponse.json({ client })
}

