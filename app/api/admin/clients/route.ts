import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get briefing counts per client
  const { data: briefings } = await supabaseAdmin
    .from('briefings')
    .select('client_id, status, created_at, completed_at')

  const statsMap: Record<string, { total: number; concluido: number; last_at: string | null }> = {}

  for (const b of briefings || []) {
    if (!statsMap[b.client_id]) statsMap[b.client_id] = { total: 0, concluido: 0, last_at: null }
    statsMap[b.client_id].total++
    if (b.status === 'concluido') statsMap[b.client_id].concluido++
    if (!statsMap[b.client_id].last_at || b.created_at > statsMap[b.client_id].last_at!) {
      statsMap[b.client_id].last_at = b.created_at
    }
  }

  const result = (clients || []).map(c => ({
    ...c,
    stats: statsMap[c.id] || { total: 0, concluido: 0, last_at: null }
  }))

  return NextResponse.json({ clients: result })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({ name: body.name, company: body.company, email: body.email, phone: body.phone, website: body.website })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
