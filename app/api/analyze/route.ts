import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { website, text } = await req.json()

    let clientInfo = ''

    // If website provided, fetch content
    if (website) {
      try {
        const res = await fetch(website, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        })
        const html = await res.text()
        // Extract text from HTML roughly
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

    if (text) {
      clientInfo += '\n\n' + text
    }

    if (!clientInfo.trim()) {
      return NextResponse.json({ error: 'Nenhuma informação fornecida' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Você é um especialista em branding e estratégia de marca. Analise as informações abaixo sobre um cliente e extraia um perfil completo e estruturado.

INFORMAÇÕES DO CLIENTE:
${clientInfo}
${website ? `\nSite analisado: ${website}` : ''}

Retorne APENAS um JSON válido com esta estrutura exata (sem markdown, sem explicações):
{
  "company_name": "nome da empresa",
  "segment": "segmento de atuação",
  "description": "descrição clara do que a empresa faz em 2-3 frases",
  "differentials": "principais diferenciais competitivos",
  "target_audience": "perfil detalhado do público-alvo",
  "brand_personality": ["adjetivo1", "adjetivo2", "adjetivo3"],
  "value_proposition": "proposta de valor principal",
  "geographic_focus": "foco geográfico de atuação",
  "price_positioning": "Premium / Alto padrão | Intermediário | Acessível / Popular",
  "tone_of_voice": "tom de voz da marca",
  "colors_hint": "sugestão de direção de cores se identificável",
  "extra_notes": "observações relevantes para o briefing"
}`
      }]
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
