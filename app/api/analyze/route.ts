import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const JSON_SCHEMA_PT = `{
  "company_name": "nome oficial da empresa",
  "segment": "segmento/nicho (ex: 'Fintech B2B', 'Clinica odontologica', 'E-commerce de moda')",
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

const JSON_SCHEMA_EN = `{
  "company_name": "official company name",
  "segment": "industry/niche (e.g. 'B2B Fintech', 'Dental Clinic', 'Fashion E-commerce')",
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

export async function POST(req: NextRequest) {
  try {
    const { website, text, company, language } = await req.json()
    const isEN = language === 'en-US'

    let clientInfo = ''

    if (website) {
      try {
        const res = await fetch(website, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        })
        const html = await res.text()
        clientInfo = html
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

    const schema = isEN ? JSON_SCHEMA_EN : JSON_SCHEMA_PT
    const prompt = isEN
      ? `You are a branding and marketing strategy expert. Analyze the client information below and extract a complete, structured profile for design briefings.

CLIENT INFORMATION:
${clientInfo}
${website ? `Website: ${website}` : ''}

Return ONLY valid JSON matching this exact structure (no markdown, no explanations):
${schema}`
      : `Voce e um especialista em branding e estrategia de marca. Analise as informacoes abaixo sobre um cliente e extraia um perfil completo e estruturado para uso em briefings de design.

INFORMACOES DO CLIENTE:
${clientInfo}
${website ? `Site analisado: ${website}` : ''}

Retorne APENAS um JSON valido com esta estrutura exata (sem markdown, sem explicacoes):
${schema}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response')

    let analysis
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : content.text)
    } catch {
      analysis = { description: content.text }
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Erro ao analisar' }, { status: 500 })
  }
}
