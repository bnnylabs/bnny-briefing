import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/profile/me
 * Public endpoint exposing the display fields of the current admin user
 * for the sidebar pill. Once Phase 4 ships real auth, this becomes
 * session-aware. Does NOT expose email.
 */
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('name, photo_url, job_title')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return NextResponse.json({
      name: data?.name || 'Bnny Labs',
      photoUrl: data?.photo_url || null,
      jobTitle: data?.job_title || 'Admin',
    })
  } catch {
    return NextResponse.json({
      name: 'Bnny Labs',
      photoUrl: null,
      jobTitle: 'Admin',
    })
  }
}
