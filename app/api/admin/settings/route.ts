import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('settings').select('*')
  const settings: Record<string, string> = {}
  data?.forEach(s => { settings[s.key] = s.value || '' })
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    await supabaseAdmin.from('settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }
  return NextResponse.json({ ok: true })
}
