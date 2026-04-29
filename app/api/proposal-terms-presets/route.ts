import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import {
  listTermsPresets,
  createTermsPreset,
  type CreateTermsPresetInput,
} from '@/lib/terms-presets'

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const presets = await listTermsPresets()
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
  body_markdown?: string
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
    const input: CreateTermsPresetInput = {
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? null,
      is_default: !!body.is_default,
      body_markdown: typeof body.body_markdown === 'string' ? body.body_markdown : '',
    }
    const preset = await createTermsPreset(input)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
