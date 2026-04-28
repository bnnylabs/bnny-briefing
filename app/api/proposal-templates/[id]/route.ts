import { NextRequest, NextResponse } from 'next/server'
import {
  deleteTemplate,
  getTemplateById,
  updateTemplate,
} from '@/lib/proposals'
import type {
  PaymentTerm,
  ProposalBlockContent,
  ProposalBlockType,
} from '@/lib/proposal-types'
import { isAuthed } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const template = await getTemplateById(id)
    if (!template) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ template })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PatchTemplateBody {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: PatchTemplateBody
  try {
    body = (await req.json()) as PatchTemplateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Reject empty-string name explicitly. Undefined is fine (means "don't change").
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }

  try {
    const template = await updateTemplate(id, body)
    if (!template) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ template })
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
    await deleteTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
