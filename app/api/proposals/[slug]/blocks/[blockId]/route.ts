import { NextRequest, NextResponse } from 'next/server'
import { deleteBlock, updateBlock, type UpdateBlockPatch } from '@/lib/proposals'
import { isAuthed } from '@/lib/auth'

interface Ctx {
  params: Promise<{ slug: string; blockId: string }>
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { blockId } = await params

  let body: Partial<UpdateBlockPatch>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: UpdateBlockPatch = {}
  if ('content' in body) patch.content = body.content
  if ('position' in body) patch.position = body.position
  if ('visible' in body) patch.visible = body.visible

  try {
    const block = await updateBlock(blockId, patch)
    return NextResponse.json({ block })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { blockId } = await params

  try {
    await deleteBlock(blockId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
