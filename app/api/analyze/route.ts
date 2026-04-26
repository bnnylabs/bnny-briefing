import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { website, text, company } = await req.json()

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
    if (company && !clientInfo.includes(company)) clientInfo = `Empresa: ${company}\n\n` + clientInfo

    if (!clientInfo.trim()) {
      return NextResponse.json({ error: 'Nenhuma informação fornecida' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `Você é um especialista em branding e estratégia de marca. Analise as informações abaixo sobre um cliente e extraia um perfil completo e estruturado para uso em briefings de design.

INFORMAÇÕES DO CLIENTE:
${clientInfo}
${website ? `\nSite analisado: ${website}` : ''}

Retorne APENAS um JSON válido com esta estrutura exata (sem markdown, sem explicações, todos os campos obrigatórios):
{
  "company_name": "nome oficial da empresa",
  "segment": "segmento/nicho de atuação (ex: 'E-commerce de moda feminina', 'Consultoria jurídica trabalhista')",
  "description": "descrição clara do que a empresa faz, seus produtos/serviços e propósito — 3 a 4 frases",
  "key_features": "principais características, produtos ou serviços oferecidos — liste os mais relevantes em texto corrido",
  "differentials": "diferenciais competitivos que tornam esta empresa única no mercado",
  "unique_value_proposition": "proposta de valor única — o que resolve, para quem e por que é melhor que alternativas",
  "target_audience": "perfil detalhado do público-alvo: demografia, comportamentos, necessidades, dores",
  "brand_personality": "personalidade da marca em 4-6 adjetivos separados por vírgula (ex: 'inovadora, sofisticada, acessível, confiável')",
  "price_positioning": "Premium / Alto padrão | Intermediário / Custo-benefício | Acessível / Popular",
  "geographic_focus": "foco geográfico de atuação (cidade, estado, país, global)",
  "tone_of_voice": "tom de voz ideal da marca (ex: 'técnico e confiável', 'descontraído e próximo', 'elegante e aspiracional')",
  "colors_hint": "direção de cores se identificável no site ou pelo segmento (ex: 'tons de verde e branco, transmite saúde')",
  "extra_notes": "observações adicionais relevantes para decisões de design e branding"
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
