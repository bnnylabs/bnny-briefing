import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import {
  listNextStepsPresets,
  createNextStepsPreset,
  type CreateNextStepsPresetInput,
} from '@/lib/next-steps-presets'

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const presets = await listNextStepsPresets()
    return NextResponse.json({ presets })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface CreateBody {
  name?: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  items?: string[]
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  try {
    const input: CreateNextStepsPresetInput = {
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? null,
      is_default: !!body.is_default,
      items: Array.isArray(body.items) ? body.items : [],
    }
    const preset = await createNextStepsPreset(input)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
