import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slugs } = await req.json()
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json({ error: 'Nenhum slug fornecido' }, { status: 400 })
  }

  // Get briefings for logging (no join to avoid type issues)
  const { data: briefings } = await supabaseAdmin
    .from('briefings').select('id, slug, type_label, status').in('slug', slugs)

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
      details: { count: slugs.length, slugs }
    })
  } catch (e) {
    console.error('[admin/bulk-delete] activity_log insert silenced:', e)
  }

  return NextResponse.json({ ok: true, deleted: slugs.length })
}
