/**
 * email-templates — DB loader for admin-edited template overrides.
 *
 * The `email_templates` table is treated as an overlay: any (type,
 * language) row stored there overrides the corresponding default in
 * lib/email-defaults.ts. If the table doesn't exist yet (fresh deploy
 * before the v4 migration runs) or the row is missing or `enabled` is
 * false, the resolver falls back to the default. This keeps the
 * runtime working on a brand-new database and lets the admin reset a
 * template by deleting its row.
 *
 * Caching: the templates table is read at most every CACHE_MS, mirror
 * of the settings cache pattern. Both the admin save endpoint and the
 * test-send endpoint call invalidateTemplateCache() to make changes
 * visible immediately rather than waiting out the TTL.
 */

import { supabaseAdmin } from './supabase'
import {
  EMAIL_DEFAULTS,
  type EmailTemplateContent,
  type TemplateLanguage,
  type TemplateType,
} from './email-defaults'

export interface ResolvedTemplate extends EmailTemplateContent {
  type: TemplateType
  language: TemplateLanguage
  is_default: boolean
}

interface TemplateRow extends EmailTemplateContent {
  type: TemplateType
  language: TemplateLanguage
  enabled: boolean
}

let templateCache = new Map<string, TemplateRow>()
let cacheAt = 0
let lastFetchOk = false
const CACHE_MS = 30_000

function cacheKey(type: TemplateType, language: TemplateLanguage): string {
  return `${type}:${language}`
}

/**
 * Reads all templates in one round trip. Errors are swallowed because
 * the table may legitimately not exist on a fresh deploy — in that
 * case lastFetchOk stays false and getTemplate falls through to
 * defaults forever (or until a successful fetch flips it).
 */
async function loadAll(): Promise<void> {
  if (lastFetchOk && Date.now() - cacheAt < CACHE_MS) return
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .select('type, language, subject, preheader, title, body_markdown, cta_text, enabled')
    if (error) {
      // Table missing or RLS denial — fall through silently. Caller
      // will get defaults.
      lastFetchOk = false
      cacheAt = Date.now()
      return
    }
    const next = new Map<string, TemplateRow>()
    ;(data ?? []).forEach((row: TemplateRow) => {
      next.set(cacheKey(row.type, row.language), row)
    })
    templateCache = next
    lastFetchOk = true
    cacheAt = Date.now()
  } catch {
    lastFetchOk = false
    cacheAt = Date.now()
  }
}

/**
 * Returns the resolved template for the given (type, language) pair.
 * `is_default` is true when the result came from EMAIL_DEFAULTS rather
 * than the DB — useful for the editor UI to surface a "default" badge.
 */
export async function getTemplate(
  type: TemplateType,
  language: TemplateLanguage,
): Promise<ResolvedTemplate> {
  await loadAll()
  const row = templateCache.get(cacheKey(type, language))
  if (row && row.enabled) {
    return {
      type,
      language,
      subject: row.subject,
      preheader: row.preheader,
      title: row.title,
      body_markdown: row.body_markdown,
      cta_text: row.cta_text,
      is_default: false,
    }
  }
  const def = EMAIL_DEFAULTS[type][language]
  return {
    type,
    language,
    ...def,
    is_default: true,
  }
}

/**
 * Returns every (type, language) pair as a resolved template. Used by
 * the admin UI to render the templates list. Defaults are returned for
 * missing rows so the list is always complete.
 */
export async function getAllTemplates(): Promise<ResolvedTemplate[]> {
  await loadAll()
  const out: ResolvedTemplate[] = []
  for (const type of Object.keys(EMAIL_DEFAULTS) as TemplateType[]) {
    for (const language of ['pt-BR', 'en-US'] as TemplateLanguage[]) {
      const row = templateCache.get(cacheKey(type, language))
      if (row && row.enabled) {
        out.push({
          type,
          language,
          subject: row.subject,
          preheader: row.preheader,
          title: row.title,
          body_markdown: row.body_markdown,
          cta_text: row.cta_text,
          is_default: false,
        })
      } else {
        out.push({
          type,
          language,
          ...EMAIL_DEFAULTS[type][language],
          is_default: true,
        })
      }
    }
  }
  return out
}

export function invalidateTemplateCache(): void {
  cacheAt = 0
  lastFetchOk = false
}
