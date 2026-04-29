import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { duplicatePaymentPreset } from '@/lib/payment-presets'

/**
 * POST /api/proposal-payment-presets/[id]/duplicate
 *
 * Creates a copy of the preset with " (cópia)" appended to the name.
 * The copy is never default (regardless of source). Useful when the
 * owner wants to derive a new preset from an existing one without
 * touching the original.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    const preset = await duplicatePaymentPreset(id)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const status = message === 'not_found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
