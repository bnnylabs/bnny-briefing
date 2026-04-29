/**
 * Live preview pipeline for the email template editor.
 *
 * The editor renders an iframe that shows what a real send would
 * produce, using sample variables and the admin's unsaved draft fields.
 * `composePreview` builds the same vars + blocks that real senders
 * would build, then delegates to `composeEmail` for the final HTML.
 *
 * Extracted from lib/email.ts (v0.10.100). Sample data per template
 * type lives here — kept close to the preview API rather than scattered
 * across each sender, since the preview is a single integration point.
 */

import {
  composeEmail,
  renderDiffSection,
  renderEditingWindowBlock,
  renderFallbackLinkBlock,
  renderMetaCard,
  type DiffChange,
  type RenderedEmail,
} from './email-render'
import type { TemplateLanguage, TemplateType } from './email-defaults'

/**
 * Renders a fully-composed preview email using sample data, optionally
 * with the admin's unsaved draft fields overriding the resolved
 * template. The preview API streams the resulting HTML into an iframe
 * srcdoc, so the editor shows the exact same output a real send would
 * produce — bit-identical pipeline, only the variable values and CTA
 * destinations are sample/mock.
 *
 * Sample blocks mirror what each sender produces from real data:
 *   • briefing_invitation     → fallback_link to a sample URL
 *   • briefing_reminder       → no blocks (reminder body has none)
 *   • briefing_confirmation   → editing_window meta card (48h)
 *   • briefing_completed_admin→ meta_card with sample client/company
 *   • briefing_updated_admin  → changes block with two sample diffs
 */
export async function composePreview({
  type,
  language,
  override,
}: {
  type: TemplateType
  language: TemplateLanguage
  override?: {
    subject?: string
    preheader?: string
    title?: string
    body_markdown?: string
    cta_text?: string
  }
}): Promise<RenderedEmail> {
  const { getSampleVariables } = await import('./email-defaults')
  const sampleVars = getSampleVariables(language)
  const sampleLink = 'https://briefing.bnnylabs.com/exemplo-preview'
  const sampleAdminUrl = 'https://briefing.bnnylabs.com/admin'

  let blocks: Record<string, string> = {}
  let ctaHref: string | undefined

  switch (type) {
    case 'briefing_invitation':
      blocks = { fallback_link: renderFallbackLinkBlock(sampleLink, language) }
      ctaHref = sampleLink
      break
    case 'briefing_reminder':
      blocks = {}
      ctaHref = sampleLink
      break
    case 'briefing_confirmation':
      blocks = { editing_window: renderEditingWindowBlock(48, language) }
      ctaHref = sampleLink
      break
    case 'briefing_completed_admin':
      blocks = {
        meta_card: renderMetaCard([
          {
            label: language === 'en-US' ? 'Client' : 'Cliente',
            value: sampleVars.client_name,
          },
          {
            label: language === 'en-US' ? 'Company' : 'Empresa',
            value: sampleVars.company,
          },
          {
            label: language === 'en-US' ? 'Type' : 'Tipo',
            value: sampleVars.type_label,
          },
          {
            label: language === 'en-US' ? 'Completed at' : 'Concluído em',
            value: sampleVars.completed_at,
          },
        ]),
      }
      ctaHref = sampleAdminUrl
      break
    case 'briefing_updated_admin': {
      const sampleChanges: DiffChange[] =
        language === 'en-US'
          ? [
              { field: 'Project goal', old: 'Brand refresh', new: 'Full identity rework' },
              { field: 'Deadline', old: '', new: 'Mid-November' },
              { field: 'Audience', old: 'B2B SaaS', new: 'B2B SaaS + DTC retail' },
            ]
          : [
              { field: 'Objetivo do projeto', old: 'Refresh de marca', new: 'Reformulação completa de identidade' },
              { field: 'Prazo', old: '', new: 'Meados de novembro' },
              { field: 'Público', old: 'B2B SaaS', new: 'B2B SaaS + varejo DTC' },
            ]
      blocks = { changes: renderDiffSection(sampleChanges, language) }
      ctaHref = sampleAdminUrl
      break
    }
    case 'proposal_sent_to_client':
      blocks = { fallback_link: renderFallbackLinkBlock(sampleLink, language) }
      ctaHref = sampleLink
      break
    case 'proposal_viewed_admin':
      blocks = {
        meta_card: renderMetaCard([
          {
            label: language === 'en-US' ? 'Client' : 'Cliente',
            value: sampleVars.client_name,
          },
          {
            label: language === 'en-US' ? 'Company' : 'Empresa',
            value: sampleVars.company,
          },
          {
            label: language === 'en-US' ? 'Proposal' : 'Proposta',
            value: `${sampleVars.proposal_number} — ${sampleVars.proposal_title}`,
          },
          {
            label: language === 'en-US' ? 'Opened at' : 'Aberta em',
            value: sampleVars.viewed_at,
          },
        ]),
      }
      ctaHref = sampleAdminUrl
      break
  }

  return composeEmail({
    type,
    language,
    vars: sampleVars,
    blocks,
    ctaHref,
    override,
  })
}
