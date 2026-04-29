import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import {
  listPaymentPresets,
  createPaymentPreset,
  type CreatePresetInput,
} from '@/lib/payment-presets'
import type { PaymentTerm } from '@/lib/proposal-types'

/**
 * Collection routes for payment presets (schema-v13).
 *
 * GET   → list all presets, sorted by is_default DESC then name ASC.
 * POST  → create a new preset with payment_terms array.
 *
 * Auth: requires admin (isAuthed) for both verbs. Presets aren't public.
 */

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const presets = await listPaymentPresets()
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
  payment_terms?: PaymentTerm[]
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
    const input: CreatePresetInput = {
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? null,
      is_default: !!body.is_default,
      payment_terms: Array.isArray(body.payment_terms) ? body.payment_terms : [],
    }
    const preset = await createPaymentPreset(input)
    return NextResponse.json({ preset })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
