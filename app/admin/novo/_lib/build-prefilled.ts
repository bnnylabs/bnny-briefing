/**
 * Maps a client's stored AI brand profile into the briefing form's
 * pre-filled values, so the operator doesn't have to retype what the
 * AI already inferred.
 *
 * Three layers of mapping logic:
 *
 *   1. Direct field-name aliasing (`directMap`) — when the AI's key
 *      matches one or two field IDs in the form schema directly. Most
 *      conceptual fields fall into this bucket.
 *
 *   2. Categorical normalization (price_positioning, brand_personality,
 *      tone_of_voice) — when the AI returns free text but the form
 *      expects a select/checkbox option. Each of these has its own
 *      lookup table that handles common synonyms, accent variants,
 *      and falls back to the raw AI value if nothing matches.
 *
 *   3. Multi-target propagation — some fields fan out to multiple
 *      form IDs (e.g. brand_tone → brand_tone + content_tone) so the
 *      operator gets consistent defaults across related questions.
 *
 * Pulled out of app/admin/novo/page.tsx in v0.10.105. Pure function,
 * no React, no side effects — helper extraction makes the page file
 * leaner and the rules independently testable.
 *
 * The contact info (name, email, phone) is intentionally NOT prefilled
 * here. It now comes from the client record on submit, not from the
 * briefing form — keeps the form focused on briefing-specific content.
 */

interface ClientFormSnapshot {
  name: string
  company: string
  email: string
  phone: string
  website: string
}

export function buildPrefilled(
  ai: Record<string, unknown>,
  // The client form is currently unused but kept in the signature for
  // forward compat — earlier versions read contact fields off it, and
  // future variants (e.g. company_name fallback when AI is empty) may
  // want it again. Cheaper to keep than to thread back later.
  _clientForm: ClientFormSnapshot,
): Record<string, unknown> {
  const prefilled: Record<string, unknown> = {}

  const directMap: Record<string, string[]> = {
    company_name: ['company_name'],
    segment: ['segment'],
    description: ['description'],
    differentials: ['differentials'],
    target_audience: ['target_audience'],
    key_features: ['key_features'],
    unique_value_proposition: ['unique_value_proposition', 'positioning'],
    geographic_focus: ['geographic_focus'],
    extra_notes: ['extra_notes'],
    colors_hint: ['color_preferences', 'color_palette'],
  }
  for (const [aiKey, fieldIds] of Object.entries(directMap)) {
    if (ai[aiKey]) {
      for (const fid of fieldIds) prefilled[fid] = ai[aiKey]
    }
  }

  if (ai.price_positioning) {
    const p = String(ai.price_positioning).toLowerCase()
    if (p.includes('premium') || p.includes('alto'))
      prefilled.price_positioning = 'Premium / Alto padrão'
    else if (
      p.includes('intermediário') ||
      p.includes('intermediario') ||
      p.includes('custo')
    )
      prefilled.price_positioning = 'Intermediário'
    else if (p.includes('acess') || p.includes('popular'))
      prefilled.price_positioning = 'Acessível / Popular'
    else prefilled.price_positioning = ai.price_positioning
  }

  if (ai.brand_personality) {
    const optionsMap: Record<string, string> = {
      moderna: 'Moderna',
      classica: 'Clássica',
      clássica: 'Clássica',
      ousada: 'Ousada',
      elegante: 'Elegante',
      divertida: 'Divertida',
      séria: 'Séria',
      seria: 'Séria',
      minimalista: 'Minimalista',
      sofisticada: 'Sofisticada',
      acessível: 'Acessível',
      acessivel: 'Acessível',
      tecnológica: 'Tecnológica',
      tecnologica: 'Tecnológica',
      humana: 'Humana',
      sustentável: 'Sustentável',
      sustentavel: 'Sustentável',
      inovadora: 'Moderna',
      criativa: 'Ousada',
      profissional: 'Séria',
      jovem: 'Divertida',
      luxo: 'Sofisticada',
    }
    const raw = String(ai.brand_personality)
    const words = raw
      .split(/[,\s]+/)
      .map((w: string) =>
        w
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''),
      )
    const matched = [
      ...new Set(words.map((w: string) => optionsMap[w]).filter(Boolean)),
    ]
    if (matched.length > 0) prefilled.brand_personality = matched
  }

  if (ai.tone_of_voice) {
    const t = String(ai.tone_of_voice).toLowerCase()
    let tone = ''
    if (t.includes('formal') || t.includes('institucional'))
      tone = 'Formal e institucional'
    else if (
      t.includes('próximo') ||
      t.includes('proximo') ||
      t.includes('profissional')
    )
      tone = 'Profissional mas próximo'
    else if (
      t.includes('descontraído') ||
      t.includes('descontraido') ||
      t.includes('jovem')
    )
      tone = 'Descontraído e jovem'
    else if (
      t.includes('técnico') ||
      t.includes('tecnico') ||
      t.includes('especialista')
    )
      tone = 'Técnico e especialista'
    if (tone) {
      prefilled.brand_tone = tone
      prefilled.content_tone = tone
    }
  }

  // Contact info now comes from client record — not pre-filled in form

  return prefilled
}
