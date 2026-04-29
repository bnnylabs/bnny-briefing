/**
 * Server-side helpers for terms presets — schema-v14.
 *
 * Use only from server contexts (API routes, server components).
 * Imports supabaseAdmin which holds the service role key.
 *
 * Same shape as payment-presets. Diff: stores TEXT body_markdown
 * instead of JSONB payment_terms. The CRUD lifecycle is identical
 * so the API route layer is also a near-mirror.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface TermsPreset {
  id: string
  name: string
  description: string | null
  type: string | null
  is_default: boolean
  body_markdown: string
  created_at: string
  updated_at: string
}

export async function listTermsPresets(): Promise<TermsPreset[]> {
  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TermsPreset[]
}

export async function getTermsPresetById(
  id: string,
): Promise<TermsPreset | null> {
  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as TermsPreset) ?? null
}

export interface CreateTermsPresetInput {
  name: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  body_markdown?: string
}

export async function createTermsPreset(
  input: CreateTermsPresetInput,
): Promise<TermsPreset> {
  const name = input.name.trim()
  if (!name) throw new Error('name_required')

  if (input.is_default) {
    await supabaseAdmin
      .from('proposal_terms_presets')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .insert({
      name,
      description: input.description?.trim() || null,
      type: input.type?.trim() || null,
      is_default: !!input.is_default,
      body_markdown: input.body_markdown ?? '',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TermsPreset
}

export interface UpdateTermsPresetInput {
  name?: string
  description?: string | null
  type?: string | null
  is_default?: boolean
  body_markdown?: string
}

export async function updateTermsPreset(
  id: string,
  input: UpdateTermsPresetInput,
): Promise<TermsPreset> {
  if (input.is_default === true) {
    await supabaseAdmin
      .from('proposal_terms_presets')
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
  if (input.body_markdown !== undefined)
    update.body_markdown = input.body_markdown

  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TermsPreset
}

export async function deleteTermsPreset(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateTermsPreset(
  id: string,
): Promise<TermsPreset> {
  const source = await getTermsPresetById(id)
  if (!source) throw new Error('not_found')

  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .insert({
      name: `${source.name} (cópia)`,
      description: source.description,
      type: source.type,
      is_default: false,
      body_markdown: source.body_markdown,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TermsPreset
}

export async function setDefaultTermsPreset(
  id: string,
): Promise<TermsPreset> {
  await supabaseAdmin
    .from('proposal_terms_presets')
    .update({ is_default: false })
    .neq('id', id)

  const { data, error } = await supabaseAdmin
    .from('proposal_terms_presets')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TermsPreset
}
