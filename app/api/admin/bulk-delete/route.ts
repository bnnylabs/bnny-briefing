import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slugs } = await req.json()
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json({ error: 'Nenhum slug fornecido' }, { status: 400 })
  }

  // Get briefings for logging
  const { data: briefings } = await supabaseAdmin
    .from('briefings').select('id, slug, type_label, status, clients(company)').in('slug', slugs)

  if (!briefings?.length) return NextResponse.json({ error: 'Briefings não encontrados' }, { status: 404 })

  const ids = briefings.map(b => b.id)

  // Delete related records
  await supabaseAdmin.from('notifications').delete().in('briefing_id', ids)
  await supabaseAdmin.from('responses').delete().in('briefing_id', ids)

  // Delete briefings
  const { error } = await supabaseAdmin.from('briefings').delete().in('slug', slugs)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log bulk deletion
  try {
    await supabaseAdmin.from('activity_log').insert({
      action: 'bulk_delete_briefings',
      details: {
        count: slugs.length,
        slugs,
        companies: briefings.map((b: { clients?: { company?: string } }) => b.clients?.company).filter(Boolean),
      }
    })
  } catch (_e) {}

  return NextResponse.json({ ok: true, deleted: slugs.length })
}
