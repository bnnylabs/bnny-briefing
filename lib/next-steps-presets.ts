/**
 * Server-side helpers for next-steps presets — schema-v15.
 *
 * Mirrors lib/payment-presets.ts and lib/terms-presets.ts. Stores
 * items[] (string[]) as JSONB instead of body_markdown/payment_terms.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface NextStepsPreset {
  id: string
  name: string
  description: string | null
  type: string | null
  is_default: boolean
  items: string[]
  created_at: string
  updated_at: string
}

export async function listNextStepsPresets(): Promise<NextStepsPreset[]> {
  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as NextStepsPreset[]
}

export async function getNextStepsPresetById(
  id: string,
): Promise<NextStepsPreset | null> {
  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as NextStepsPreset) ?? null
}

export interface CreateNextStepsPresetInput {
  name: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  items?: string[]
}

export async function createNextStepsPreset(
  input: CreateNextStepsPresetInput,
): Promise<NextStepsPreset> {
  const name = input.name.trim()
  if (!name) throw new Error('name_required')

  if (input.is_default) {
    await supabaseAdmin
      .from('proposal_next_steps_presets')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .insert({
      name,
      description: input.description?.trim() || null,
      type: input.type?.trim() || null,
      is_default: !!input.is_default,
      items: Array.isArray(input.items) ? input.items.filter((s) => s?.trim()) : [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NextStepsPreset
}

export interface UpdateNextStepsPresetInput {
  name?: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  items?: string[]
}

export async function updateNextStepsPreset(
  id: string,
  input: UpdateNextStepsPresetInput,
): Promise<NextStepsPreset> {
  if (input.is_default === true) {
    await supabaseAdmin
      .from('proposal_next_steps_presets')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', id)
  }

  const update: Record<string, unknown> = {}
  if (typeof input.name === 'string') update.name = input.name.trim()
  if (input.description !== undefined)
    update.description = input.description?.trim() || null
  if (input.type !== undefined) update.type = input.type?.trim() || null
  if (input.is_default !== undefined) update.is_default = !!input.is_default
  if (Array.isArray(input.items))
    update.items = input.items.filter((s) => s?.trim())

  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NextStepsPreset
}

export async function deleteNextStepsPreset(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateNextStepsPreset(
  id: string,
): Promise<NextStepsPreset> {
  const source = await getNextStepsPresetById(id)
  if (!source) throw new Error('not_found')

  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .insert({
      name: `${source.name} (cópia)`,
      description: source.description,
      type: source.type,
      is_default: false,
      items: source.items,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NextStepsPreset
}

export async function setDefaultNextStepsPreset(
  id: string,
): Promise<NextStepsPreset> {
  await supabaseAdmin
    .from('proposal_next_steps_presets')
    .update({ is_default: false })
    .neq('id', id)

  const { data, error } = await supabaseAdmin
    .from('proposal_next_steps_presets')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NextStepsPreset
}
