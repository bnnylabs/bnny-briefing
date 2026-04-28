/**
 * /api/analyze — AI brand profile extraction
 *
 * Phase 7a change: social link extraction added.
 *
 * Two-layer approach for maximum reliability:
 *   1. Regex over raw HTML (before stripping tags) — catches every
 *      <a href="https://instagram.com/..."> in headers and footers even
 *      when Claude wouldn't see the URL in stripped text.
 *   2. Claude JSON schema includes social_links — Claude fills in any
 *      handles mentioned in visible text that weren't in href attributes
 *      (e.g., "Follow us @empresa" in body copy).
 *
 * The merged result (regex first, Claude fills gaps) is returned in the
 * `social_links` top-level field alongside `analysis`. The client detail
 * page saves social_links columns separately from the analysis JSONB so
 * they're directly queryable without JSON drilling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { lookup as dnsLookup } from 'node:dns/promises'
import { requireAuth } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'

// ─── SSRF defense ────────────────────────────────────────────────────────
//
// The /analyze endpoint fetches whatever URL the caller gives us. Without
// guards, an attacker (or in single-admin mode, a careless paste) could
// point us at internal IPs reachable from the Vercel function runtime —
// link-local AWS metadata, RFC1918 private ranges, loopback, etc. This
// helper rejects any URL whose hostname resolves to a private/internal IP.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false
  const [a, b] = parts
  // 10.0.0.0/8
  if (a === 10) return true
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // 127.0.0.0/8 — loopback
  if (a === 127) return true
  // 169.254.0.0/16 — link-local (cloud metadata)
  if (a === 169 && b === 254) return true
  // 0.0.0.0/8
  if (a === 0) return true
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  // fc00::/7 (unique local), fe80::/10 (link-local)
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8')) return true
  // IPv4-mapped (::ffff:a.b.c.d) — re-test as v4
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPrivateIPv4(v4)
  }
  return false
}

/**
 * Validate a URL is safe to fetch from the server: must be http(s),
 * hostname must resolve to a public IP. Returns null if safe, or an
 * error message string if rejected.
 */
async function validateExternalUrl(input: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return 'URL inválida'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Apenas http e https são suportados'
  }

  // Reject hostnames that are literal IPs in private ranges, even before
  // DNS — saves a round trip and catches direct numeric inputs.
  const host = parsed.hostname.toLowerCase()
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIPv4(host)) {
    return 'Endereços internos não são permitidos'
  }
  if (host.includes(':') && isPrivateIPv6(host)) {
    return 'Endereços internos não são permitidos'
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'Endereços internos não são permitidos'
  }

  // Resolve DNS and check every returned address.
  try {
    const records = await dnsLookup(host, { all: true })
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) {
        return 'Endereços internos não são permitidos'
      }
      if (r.family === 6 && isPrivateIPv6(r.address)) {
        return 'Endereços internos não são permitidos'
      }
    }
  } catch {
    return 'Não foi possível resolver o domínio'
  }

  return null
}

// ─── Social link extraction from raw HTML ────────────────────────────────

export interface SocialLinks {
  instagram?: string
  linkedin?: string
  facebook?: string
  youtube?: string
  tiktok?: string
  twitter?: string
  pinterest?: string
  other?: string
}

const SOCIAL_PATTERNS: Array<{ key: keyof SocialLinks; pattern: RegExp }> = [
  {
    key: 'instagram',
    pattern: /https?:\/\/(?:www\.)?instagram\.com\/(?!(?:p|reel|stories|explore|accounts)\/)([\w.]+)\/?/i,
  },
  {
    key: 'linkedin',
    pattern: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/([\w%-]+)\/?/i,
  },
  {
    key: 'facebook',
    pattern: /https?:\/\/(?:www\.)?facebook\.com\/([\w.]+)\/?(?!\?)/i,
  },
  {
    key: 'youtube',
    pattern: /https?:\/\/(?:www\.)?youtube\.com\/(?:@[\w-]+|channel\/[\w-]+|c\/[\w-]+)/i,
  },
  {
    key: 'tiktok',
    pattern: /https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)\/?/i,
  },
  {
    key: 'twitter',
    pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([\w]+)\/?(?!\?)/i,
  },
  {
    key: 'pinterest',
    pattern: /https?:\/\/(?:www\.)?pinterest\.com\/([\w-]+)\/?/i,
  },
]

// Extract full URLs from href attributes in raw HTML.
// We use the raw HTML before stripping tags so we get the actual link
// destinations rather than display text.
function extractHrefs(html: string): string[] {
  const hrefs: string[] = []
  const re = /href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1])
  }
  return hrefs
}

export function extractSocialLinksFromHtml(html: string): SocialLinks {
  const hrefs = extractHrefs(html)
  const result: SocialLinks = {}

  for (const href of hrefs) {
    for (const { key, pattern } of SOCIAL_PATTERNS) {
      if (!result[key] && pattern.test(href)) {
        // Store the clean full URL, not just the handle
        result[key] = href.split('?')[0].replace(/\/$/, '')
        break
      }
    }
  }

  return result
}

/** Merges Claude-returned social_links into regex-extracted ones.
 *  Regex results take priority (they come from actual <a> tags).
 *  Claude fills in any key not already found by regex. */
function mergeSocialLinks(
  fromHtml: SocialLinks,
  fromClaude: Partial<SocialLinks> | null | undefined,
): SocialLinks {
  if (!fromClaude) return fromHtml
  const merged: SocialLinks = { ...fromHtml }
  for (const key of Object.keys(fromClaude) as (keyof SocialLinks)[]) {
    const val = fromClaude[key]
    if (!merged[key] && val && typeof val === 'string' && val.startsWith('http')) {
      merged[key] = val
    }
  }
  return merged
}

// ─── Claude prompt schemas ────────────────────────────────────────────────

const SOCIAL_SCHEMA_FRAGMENT_PT = `
  "social_links": {
    "instagram": "URL completa do Instagram da empresa (https://instagram.com/...) ou null",
    "linkedin": "URL completa do LinkedIn da empresa (https://linkedin.com/company/...) ou null",
    "facebook": "URL completa do Facebook da empresa ou null",
    "youtube": "URL completa do YouTube da empresa ou null",
    "tiktok": "URL completa do TikTok da empresa ou null",
    "twitter": "URL completa do X/Twitter da empresa ou null",
    "pinterest": "URL completa do Pinterest da empresa ou null"
  },`

const SOCIAL_SCHEMA_FRAGMENT_EN = `
  "social_links": {
    "instagram": "Full Instagram URL (https://instagram.com/...) or null",
    "linkedin": "Full LinkedIn URL (https://linkedin.com/company/...) or null",
    "facebook": "Full Facebook URL or null",
    "youtube": "Full YouTube URL or null",
    "tiktok": "Full TikTok URL or null",
    "twitter": "Full X/Twitter URL or null",
    "pinterest": "Full Pinterest URL or null"
  },`

const JSON_SCHEMA_PT = (includeSocial: boolean) => `{
${includeSocial ? SOCIAL_SCHEMA_FRAGMENT_PT : ''}
  "company_name": "nome oficial da empresa",
  "segment": "array de 1 a 3 palavras-chave curtas (max 2 palavras cada) que classificam o nicho da empresa — sem artigos, sem verbos, sem descricao. Ex: ['SaaS', 'B2B', 'RH'] ou ['E-commerce', 'Moda'] ou ['Clinica', 'Odontologia']. Retornar como string separada por virgula: 'SaaS, B2B, RH'",
  "description": "descricao clara do que a empresa faz — 3 a 4 frases",
  "key_features": "principais produtos ou servicos em texto corrido",
  "differentials": "diferenciais competitivos unicos no mercado",
  "unique_value_proposition": "proposta de valor — o que resolve, para quem e por que e melhor",
  "target_audience": "perfil do publico-alvo: demografia, comportamentos, dores",
  "brand_personality": "personalidade da marca em 4-6 adjetivos (ex: 'inovadora, sofisticada, confiavel')",
  "price_positioning": "Premium / Alto padrao | Intermediario / Custo-beneficio | Acessivel / Popular",
  "geographic_focus": "foco geografico (cidade, estado, pais, global)",
  "tone_of_voice": "tom de voz ideal (ex: 'tecnico e confiavel', 'descontraido e proximo')",
  "colors_hint": "direcao de cores se identificavel (ex: 'tons de azul e branco, transmite tecnologia')",
  "extra_notes": "observacoes adicionais relevantes para decisoes de design"
}`

const JSON_SCHEMA_EN = (includeSocial: boolean) => `{
${includeSocial ? SOCIAL_SCHEMA_FRAGMENT_EN : ''}
  "company_name": "official company name",
  "segment": "array of 1 to 3 short keywords (max 2 words each) classifying the company niche — no articles, no verbs, no descriptions. E.g. ['SaaS', 'B2B', 'HR'] or ['E-commerce', 'Fashion']. Return as comma-separated string: 'SaaS, B2B, HR'",
  "description": "clear description of what the company does — 3 to 4 sentences",
  "key_features": "main products or services in prose",
  "differentials": "unique competitive differentials",
  "unique_value_proposition": "value proposition — what it solves, for whom and why it is better",
  "target_audience": "target audience profile: demographics, behaviors, pain points",
  "brand_personality": "brand personality in 4-6 adjectives (e.g. 'innovative, sophisticated, trustworthy')",
  "price_positioning": "Premium / High-end | Mid-market / Value | Accessible / Popular",
  "geographic_focus": "geographic focus (city, state, country, global)",
  "tone_of_voice": "ideal tone of voice (e.g. 'technical and trustworthy', 'casual and approachable')",
  "colors_hint": "color direction if identifiable (e.g. 'shades of blue and white, conveys technology')",
  "extra_notes": "additional observations relevant for design decisions"
}`

// ─── Route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  try {
    const { website, text, company, language } = await req.json()
    const isEN = language === 'en-US'

    let rawHtml = ''
    let clientInfo = ''

    if (website) {
      // Reject SSRF candidates BEFORE making the fetch. We tolerate the
      // extra DNS round-trip because /analyze is admin-only and gets
      // hit a few times per client onboarding, not per request.
      const ssrfErr = await validateExternalUrl(website)
      if (ssrfErr) {
        return NextResponse.json({ error: ssrfErr }, { status: 400 })
      }

      try {
        const res = await fetch(website, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BnnyBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        })
        rawHtml = await res.text()

        // Strip scripts/styles/tags for the Claude text pass
        clientInfo = rawHtml
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6000)
      } catch (e) {
        console.error('Could not fetch website:', e)
      }
    }

    if (text) clientInfo += '\n\n' + text
    if (company && !clientInfo.includes(company)) clientInfo = `Company: ${company}\n\n` + clientInfo

    if (!clientInfo.trim()) {
      return NextResponse.json({ error: 'No information provided' }, { status: 400 })
    }

    // Layer 1: regex extraction from raw HTML (fast, reliable for href links)
    const socialFromHtml = rawHtml ? extractSocialLinksFromHtml(rawHtml) : {}

    // Layer 2: Claude — include social in schema only when we have a website
    // to analyse (no point asking Claude to invent social links from text only)
    const hasSiteContent = !!rawHtml
    const schema = isEN ? JSON_SCHEMA_EN(hasSiteContent) : JSON_SCHEMA_PT(hasSiteContent)

    const prompt = isEN
      ? `You are a branding and marketing strategy expert. Analyze the client information below and extract a complete, structured profile for design briefings.${hasSiteContent ? ' Also extract any social media profile URLs you find in the content.' : ''}

CLIENT INFORMATION:
${clientInfo}
${website ? `Website: ${website}` : ''}

Return ONLY valid JSON matching this exact structure (no markdown, no explanations):
${schema}`
      : `Voce e um especialista em branding e estrategia de marca. Analise as informacoes abaixo sobre um cliente e extraia um perfil completo e estruturado para uso em briefings de design.${hasSiteContent ? ' Extraia tambem quaisquer URLs de redes sociais que encontrar no conteudo.' : ''}

INFORMACOES DO CLIENTE:
${clientInfo}
${website ? `Site analisado: ${website}` : ''}

Retorne APENAS um JSON valido com esta estrutura exata (sem markdown, sem explicacoes):
${schema}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response')

    let parsed: Record<string, unknown>
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content.text)
    } catch {
      parsed = { description: content.text }
    }

    // Extract social_links from Claude's response, merge with regex results
    const socialFromClaude = parsed.social_links as Partial<SocialLinks> | null | undefined
    const socialLinks = mergeSocialLinks(socialFromHtml, socialFromClaude)

    // Remove social_links from the analysis object — they're stored separately
    // in dedicated columns, not inside clients.analysis JSONB
    const { social_links: _dropped, ...analysis } = parsed as Record<string, unknown> & {
      social_links?: unknown
    }
    void _dropped

    return NextResponse.json({ analysis, social_links: socialLinks })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erro ao analisar' }, { status: 500 })
  }
}
