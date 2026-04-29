import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { setDefaultPaymentPreset } from '@/lib/payment-presets'

/**
 * POST /api/proposal-payment-presets/[id]/set-default
 *
 * Sets this preset as default, clearing the flag on every other preset.
 * Two-step (set false on others, then true on target) — same approach
 * as templates. Race window admin-only, acceptable.
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
    const preset = await setDefaultPaymentPreset(id)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
