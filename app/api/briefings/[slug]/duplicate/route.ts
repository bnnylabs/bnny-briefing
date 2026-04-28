import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateSlug } from '@/lib/briefing-types'
import { isAuthed } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  const { data: original } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()

  if (!original) return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })

  const newSlug = generateSlug(original.clients?.company || 'briefing')
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()

  const { data: newBriefing, error } = await supabaseAdmin
    .from('briefings').insert({
      client_id: original.client_id,
      slug: newSlug,
      type: original.type,
      type_label: original.type_label,
      status: 'enviado',
      prefilled_data: original.prefilled_data || {},
      internal_notes: null,
      expires_at: expiresAt,
    }).select('*, clients(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`
  const link = `${baseUrl}/${newSlug}`

  // Log activity
  try {
    await supabaseAdmin.from('activity_log').insert({
      action: 'duplicate_briefing',
      details: {
        original_slug: slug,
        new_slug: newSlug,
        company: original.clients?.company,
        type_label: original.type_label,
      }
    })
  } catch (_e) {}

  return NextResponse.json({ briefing: newBriefing, link })
}
