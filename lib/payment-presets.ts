/**
 * Server-side helpers for payment presets — schema-v13.
 *
 * Use only from server contexts (API routes, server components).
 * Imports supabaseAdmin which holds the service role key.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { PaymentTerm } from '@/lib/proposal-types'

export interface PaymentPreset {
  id: string
  name: string
  description: string | null
  type: string | null
  is_default: boolean
  payment_terms: PaymentTerm[]
  created_at: string
  updated_at: string
}

export async function listPaymentPresets(): Promise<PaymentPreset[]> {
  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentPreset[]
}

export async function getPaymentPresetById(
  id: string,
): Promise<PaymentPreset | null> {
  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as PaymentPreset) ?? null
}

export interface CreatePresetInput {
  name: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  payment_terms?: PaymentTerm[]
}

export async function createPaymentPreset(
  input: CreatePresetInput,
): Promise<PaymentPreset> {
  const name = input.name.trim()
  if (!name) throw new Error('name_required')

  // If this preset is being set as default, clear the flag on others
  // first. Single transaction would be ideal; we approximate with two
  // statements — race window is tiny in practice (admin-only writes).
  if (input.is_default) {
    await supabaseAdmin
      .from('proposal_payment_presets')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .insert({
      name,
      description: input.description?.trim() || null,
      type: input.type?.trim() || null,
      is_default: !!input.is_default,
      payment_terms: input.payment_terms ?? [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PaymentPreset
}

export interface UpdatePresetInput {
  name?: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  payment_terms?: PaymentTerm[]
}

export async function updatePaymentPreset(
  id: string,
  input: UpdatePresetInput,
): Promise<PaymentPreset> {
  // Same default-flag handling as create — if new value is true, clear
  // any other default first.
  if (input.is_default === true) {
    await supabaseAdmin
      .from('proposal_payment_presets')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', id) // don't unset ourselves before we set
  }

  const update: Record<string, unknown> = {}
  if (typeof input.name === 'string') update.name = input.name.trim()
  if (input.description !== undefined)
    update.description = input.description?.trim() || null
  if (input.type !== undefined) update.type = input.type?.trim() || null
  if (input.is_default !== undefined) update.is_default = !!input.is_default
  if (input.payment_terms !== undefined)
    update.payment_terms = input.payment_terms

  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PaymentPreset
}

export async function deletePaymentPreset(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Duplicate a preset. New row gets " (cópia)" suffix on name and is
 * never marked as default (regardless of source).
 */
export async function duplicatePaymentPreset(
  id: string,
): Promise<PaymentPreset> {
  const source = await getPaymentPresetById(id)
  if (!source) throw new Error('not_found')

  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .insert({
      name: `${source.name} (cópia)`,
      description: source.description,
      type: source.type,
      is_default: false,
      payment_terms: source.payment_terms,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PaymentPreset
}

/**
 * Mark a preset as default, clearing the flag on every other preset.
 * Two-step (set false on others, set true on target) — same approach
 * as createTemplate / updateTemplate in lib/proposals.ts.
 */
export async function setDefaultPaymentPreset(
  id: string,
): Promise<PaymentPreset> {
  await supabaseAdmin
    .from('proposal_payment_presets')
    .update({ is_default: false })
    .neq('id', id)

  const { data, error } = await supabaseAdmin
    .from('proposal_payment_presets')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as PaymentPreset
}
