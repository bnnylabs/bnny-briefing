import { NextRequest, NextResponse } from 'next/server'
import { duplicateTemplate } from '@/lib/proposals'
import { isAuthed } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const template = await duplicateTemplate(id)
    if (!template) {
      return NextResponse.json({ error: 'Source template not found' }, { status: 404 })
    }
    return NextResponse.json({ template }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
