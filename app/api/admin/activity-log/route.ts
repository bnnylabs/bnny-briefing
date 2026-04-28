import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    // Table might not exist yet — return empty
    return NextResponse.json({ logs: [] })
  }

  return NextResponse.json({ logs: data || [] })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, details } = body

  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .insert({ action, details: details || {} })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log: data })
}
