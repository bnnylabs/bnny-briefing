import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { setDefaultNextStepsPreset } from '@/lib/next-steps-presets'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    const preset = await setDefaultNextStepsPreset(id)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
