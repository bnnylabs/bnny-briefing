import { NextRequest, NextResponse } from 'next/server'
import { createProposal, listProposals } from '@/lib/proposals'
import type { ProposalLanguage } from '@/lib/proposal-types'

/**
 * /api/proposals — Phase 1 of v0.10 (Propostas).
 *
 * GET  → list all proposals (admin)
 * POST → create a draft proposal (admin)
 *
 * Authentication mirrors the briefings route: cookie `bnny_auth` must
 * equal `ADMIN_PASSWORD`. Same model the rest of the admin uses.
 */

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const proposals = await listProposals()
    return NextResponse.json({ proposals })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    client_id?: string
    title?: string
    language?: ProposalLanguage
    valid_until?: string | null
    briefing_id?: string | null
    template_id?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Minimum required fields
  if (!body.client_id || !body.title?.trim()) {
    return NextResponse.json(
      { error: 'client_id and title are required' },
      { status: 400 },
    )
  }

  try {
    const proposal = await createProposal({
      client_id: body.client_id,
      title: body.title,
      language: body.language,
      valid_until: body.valid_until ?? null,
      briefing_id: body.briefing_id ?? null,
      template_id: body.template_id ?? null,
    })
    return NextResponse.json({ proposal }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
