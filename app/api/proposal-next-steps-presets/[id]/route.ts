import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import {
  getNextStepsPresetById,
  updateNextStepsPreset,
  deleteNextStepsPreset,
  type UpdateNextStepsPresetInput,
} from '@/lib/next-steps-presets'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const preset = await getNextStepsPresetById(id)
    if (!preset) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PatchBody {
  name?: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  items?: string[]
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const input: UpdateNextStepsPresetInput = {}
    if (typeof body.name === 'string') input.name = body.name
    if (body.description !== undefined) input.description = body.description
    if (body.type !== undefined) input.type = body.type
    if (body.is_default !== undefined) input.is_default = body.is_default
    if (Array.isArray(body.items)) input.items = body.items

    const preset = await updateNextStepsPreset(id, input)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await deleteNextStepsPreset(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
