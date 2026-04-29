import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import {
  getPaymentPresetById,
  updatePaymentPreset,
  deletePaymentPreset,
  type UpdatePresetInput,
} from '@/lib/payment-presets'
import type { PaymentTerm } from '@/lib/proposal-types'

/**
 * Per-preset routes (/api/proposal-payment-presets/[id]):
 *   GET    → fetch single
 *   PATCH  → partial update of any field, including payment_terms array
 *   DELETE → remove preset (no soft delete; proposals that already
 *            applied a preset hold their own snapshot of the terms)
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const preset = await getPaymentPresetById(id)
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
  payment_terms?: PaymentTerm[]
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
    // Build an UpdatePresetInput preserving null-vs-undefined distinction.
    // updatePaymentPreset only writes fields that are present (not
    // undefined) — null is the explicit "clear it" signal.
    const input: UpdatePresetInput = {}
    if (typeof body.name === 'string') input.name = body.name
    if (body.description !== undefined) input.description = body.description
    if (body.type !== undefined) input.type = body.type
    if (body.is_default !== undefined) input.is_default = body.is_default
    if (Array.isArray(body.payment_terms))
      input.payment_terms = body.payment_terms

    const preset = await updatePaymentPreset(id, input)
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
    await deletePaymentPreset(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
