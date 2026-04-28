import { NextRequest, NextResponse } from 'next/server'
import { createTemplate, listTemplates } from '@/lib/proposals'
import type { PaymentTerm, ProposalBlockContent, ProposalBlockType } from '@/lib/proposal-types'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const templates = await listTemplates()
    return NextResponse.json({ templates })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface CreateTemplateBody {
  name?: string
  description?: string | null
  type?: string | null
  default_blocks?: Array<{
    type: ProposalBlockType
    content: ProposalBlockContent
    position: number
    visible: boolean
  }>
  default_payment_terms?: PaymentTerm[]
  is_default?: boolean
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTemplateBody
  try {
    body = (await req.json()) as CreateTemplateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const template = await createTemplate({
      name,
      description: body.description ?? null,
      type: body.type ?? null,
      default_blocks: body.default_blocks ?? [],
      default_payment_terms: body.default_payment_terms ?? [],
      is_default: body.is_default ?? false,
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
