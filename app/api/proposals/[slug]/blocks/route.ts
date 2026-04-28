import { NextRequest, NextResponse } from 'next/server'
import {
  createBlock,
  getProposalBySlug,
  listBlocks,
} from '@/lib/proposals'
import type { ProposalBlockContent, ProposalBlockType } from '@/lib/proposal-types'
import { isAuthed } from '@/lib/auth'

interface Ctx {
  params: Promise<{ slug: string }>
}

const VALID_TYPES: ProposalBlockType[] = [
  'header',
  'phases',
  'investment',
  'terms',
  'next_steps',
  'attachments',
  'custom',
]

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params
  try {
    const proposal = await getProposalBySlug(slug)
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const blocks = await listBlocks(proposal.id)
    return NextResponse.json({ blocks })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params

  let body: {
    type?: ProposalBlockType
    content?: ProposalBlockContent
    position?: number
    visible?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid block type' }, { status: 400 })
  }

  try {
    const proposal = await getProposalBySlug(slug)
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const block = await createBlock({
      proposal_id: proposal.id,
      type: body.type,
      content: body.content,
      position: body.position,
      visible: body.visible,
    })
    return NextResponse.json({ block }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
