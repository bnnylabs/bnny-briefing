/**
 * Block review engine — Phase G+ "Revisar com IA".
 *
 * Reviews the prose of a proposal block in place: improves clarity,
 * concision, tone, and (in PT-BR) strips AI clichés. Does NOT change
 * language — that's lib/translate.ts.
 *
 * Same extract → transform → reconstruct pattern as translation, sharing
 * lib/block-strings.ts. The AI sees a flat array of prose strings and
 * returns the same array, edited. Numbers, URLs, and IDs never leave Node
 * — the model can't accidentally damage shape.
 *
 * Distinct from RewriteButton (one field at a time, free-form):
 *   - Review handles every textual field of a block in one pass
 *   - Review preserves field structure exactly
 *   - Review is the per-block button on each card; RewriteButton stays
 *     for fine-grained per-textarea use
 *
 * Like translation, this engine does NOT persist. Caller (the API route
 * + the Dialog UI) is responsible for showing diff and applying.
 */

import { anthropic } from '@/lib/anthropic'
import {
  ANTI_CLICHE_RULES_PT,
  SECTION_DIVIDER,
  STUDIO_IDENTITY_PT,
} from '@/lib/ai-style-rules'
import { extractBlockStrings } from '@/lib/block-strings'
import type {
  ProposalBlockContent,
  ProposalBlockType,
  ProposalLanguage,
} from '@/lib/proposal-types'

export type ReviewFoco = 'all' | 'concisao' | 'clareza' | 'tom'

export interface ReviewOptions {
  /** Foco da revisão. 'all' = melhoria geral. */
  foco?: ReviewFoco
  /**
   * Instrução livre do operador. Levada como autoridade máxima no prompt
   * (mesmo padrão do owner_directives_block do ai-style-rules).
   * Ex: "deixa mais formal", "remove a menção a prazo".
   */
  instruction?: string
}

export interface ReviewBlockResult {
  /** Content como veio — útil pra Dialog mostrar lado-a-lado. */
  original: ProposalBlockContent
  /** Content revisado — caller decide se aplica. NÃO persistido. */
  revised: ProposalBlockContent
  /** Quantas strings textuais mudaram (depois de trim). */
  changedCount: number
  /** Total de strings textuais (numerador da razão de mudança). */
  totalCount: number
}

const REVIEW_MODEL = 'claude-haiku-4-5'

const REVIEW_TOOL = {
  name: 'review_strings',
  description:
    'Devolve o array de strings revisado. O array de saída TEM que ter exatamente o mesmo número de elementos do array de entrada, na mesma ordem.',
  input_schema: {
    type: 'object' as const,
    properties: {
      revised: {
        type: 'array',
        description:
          'Array com as strings revisadas, na MESMA ORDEM e com o MESMO TAMANHO do array de entrada. Se uma string original não precisar de mudanças, devolva ela igual. Strings vazias na entrada devem virar strings vazias na saída.',
        items: { type: 'string' },
      },
    },
    required: ['revised'],
  },
}

interface ReviewToolOutput {
  revised: string[]
}

const FOCO_INSTRUCTIONS: Record<ReviewFoco, string> = {
  all: 'Melhoria geral: clareza, concisão, fluidez. Corte clichês e gordura.',
  concisao:
    'FOCO PRINCIPAL: concisão. Corte palavras desnecessárias, encurte frases, remova repetições. Mantenha o sentido.',
  clareza:
    'FOCO PRINCIPAL: clareza. Reescreva trechos confusos, esclareça referências ambíguas, ordene ideias logicamente.',
  tom: 'FOCO PRINCIPAL: tom. Ajuste pra ficar profissional, direto e humano. Sem corporativês, sem servilismo, sem entusiasmo artificial.',
}

const LANG_LABEL: Record<ProposalLanguage, string> = {
  'pt-BR': 'português brasileiro',
  'en-US': 'inglês americano (en-US)',
}

function buildReviewPrompt(
  lang: ProposalLanguage,
  blockType: ProposalBlockType,
  strings: string[],
  options: ReviewOptions,
): string {
  const foco = options.foco ?? 'all'

  // Identidade + anti-cliché só fazem sentido em PT — em EN o ruleset
  // PT-BR confunde mais do que ajuda, então mandamos um equivalente curto.
  const identity =
    lang === 'pt-BR'
      ? STUDIO_IDENTITY_PT
      : 'You review proposal copy for Bnny Labs, a creative studio. Voice: professional, direct, human. Avoid corporate buzzwords and AI-flavored phrasing.'

  const styleRules = lang === 'pt-BR' ? ANTI_CLICHE_RULES_PT : ''

  const ownerInstruction = options.instruction?.trim()
  const ownerBlock = ownerInstruction
    ? `${SECTION_DIVIDER}
INSTRUÇÃO DO OWNER (PRIORIDADE MÁXIMA — sobrepõe foco e regras gerais)
${SECTION_DIVIDER}
${ownerInstruction}

`
    : ''

  const arrayPreview = strings
    .map((s, i) => `[${i}] ${JSON.stringify(s)}`)
    .join('\n')

  return `${identity}

${ownerBlock}Sua tarefa: revisar um array de strings de um bloco de proposta do tipo "${blockType}", em ${LANG_LABEL[lang]}. NÃO traduza — mantenha o idioma original. Apenas melhore o texto.

${SECTION_DIVIDER}
FOCO DA REVISÃO
${SECTION_DIVIDER}
${FOCO_INSTRUCTIONS[foco]}

REGRAS GERAIS:
1. PRESERVE markdown se houver (## títulos, **negrito**, listas com - ou *, links [text](url)).
2. PRESERVE placeholders entre colchetes: [Cliente], [Project Name], etc.
3. NÃO traduza nomes próprios (Bnny Labs, nomes de pessoas, marcas).
4. NÃO invente informação nova nem remova conteúdo essencial. Mantenha fatos, datas, números.
5. Se uma string já estiver boa, devolva ela IGUAL — não mude por mudar.
6. Se a string original é vazia, devolva string vazia.
7. NÚMEROS e códigos (1.0, 2.0, BRL, USD) ficam intactos quando aparecerem dentro do texto.
8. O array de saída TEM que ter exatamente ${strings.length} elementos, na mesma ordem.

${styleRules ? `${styleRules}\n\n` : ''}ARRAY DE ENTRADA (${strings.length} strings):
${arrayPreview}

Agora chama a tool review_strings com o array revisado.`
}

export async function reviewBlock(
  block: { type: ProposalBlockType; content: ProposalBlockContent },
  lang: ProposalLanguage,
  options: ReviewOptions = {},
): Promise<ReviewBlockResult> {
  const extractor = extractBlockStrings(block.type, block.content)

  // Caminho rápido: nada pra revisar (ex: attachments só com URLs, ou
  // bloco vazio). Devolve original = revised, changedCount = 0.
  const hasContent = extractor.strings.some((s) => s && s.trim().length > 0)
  if (!hasContent) {
    return {
      original: block.content,
      revised: block.content,
      changedCount: 0,
      totalCount: extractor.strings.length,
    }
  }

  const prompt = buildReviewPrompt(lang, block.type, extractor.strings, options)

  const msg = await anthropic.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 4096,
    tools: [REVIEW_TOOL],
    tool_choice: { type: 'tool', name: 'review_strings' },
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = msg.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('IA não retornou chamada de tool válida')
  }

  const out = toolUse.input as ReviewToolOutput
  if (!Array.isArray(out.revised)) {
    throw new Error('Tool input.revised não é array')
  }

  // Padding defensivo: tamanho errado → preenche com original.
  const expected = extractor.strings.length
  const fixed: string[] = []
  for (let i = 0; i < expected; i++) {
    const v = out.revised[i]
    fixed.push(typeof v === 'string' ? v : extractor.strings[i])
  }

  // Conta strings cujo conteúdo mudou efetivamente (ignora trim diff,
  // que aparece muito em revisão sem ser mudança real).
  let changedCount = 0
  for (let i = 0; i < expected; i++) {
    if ((extractor.strings[i] ?? '').trim() !== (fixed[i] ?? '').trim()) {
      changedCount++
    }
  }

  const revised = extractor.reconstruct(fixed)

  return {
    original: block.content,
    revised,
    changedCount,
    totalCount: expected,
  }
}

// ─── Helpers exposto pra UI de diff ─────────────────────────────────────

/**
 * Extrai pares { label, before, after } de cada campo textual do bloco
 * pra o Dialog mostrar uma comparação amigável. Usa o extractor compartilhado.
 *
 * Os labels são gerados por tipo (ex: "Texto de abertura" pra header,
 * "Fase 1 · título" / "Fase 1 · descrição" pra phases). Mantém o array
 * em ordem com extractor.strings, então índice = índice das strings.
 */
export function buildReviewDiffPairs(
  type: ProposalBlockType,
  before: ProposalBlockContent,
  after: ProposalBlockContent,
): Array<{ label: string; before: string; after: string; changed: boolean }> {
  const beforeExtractor = extractBlockStrings(type, before)
  const afterExtractor = extractBlockStrings(type, after)
  const labels = labelStrings(type, beforeExtractor.strings.length)

  const pairs: Array<{ label: string; before: string; after: string; changed: boolean }> = []
  for (let i = 0; i < beforeExtractor.strings.length; i++) {
    const b = beforeExtractor.strings[i] ?? ''
    const a = afterExtractor.strings[i] ?? ''
    pairs.push({
      label: labels[i] ?? `Campo ${i + 1}`,
      before: b,
      after: a,
      changed: b.trim() !== a.trim(),
    })
  }
  return pairs
}

function labelStrings(type: ProposalBlockType, count: number): string[] {
  switch (type) {
    case 'header':
      return ['Texto de abertura']
    case 'phases': {
      // Phases: cada fase tem 3 strings (title, duration, description).
      const out: string[] = []
      const phaseCount = Math.floor(count / 3)
      for (let i = 0; i < phaseCount; i++) {
        out.push(`Fase ${i + 1} · título`, `Fase ${i + 1} · duração`, `Fase ${i + 1} · descrição`)
      }
      return out
    }
    case 'investment': {
      // [intro, ...(label, description) por termo]
      const out: string[] = ['Introdução']
      const termCount = Math.floor((count - 1) / 2)
      for (let i = 0; i < termCount; i++) {
        out.push(`Pagamento ${i + 1} · nome`, `Pagamento ${i + 1} · descrição`)
      }
      return out
    }
    case 'terms':
      return ['Termos & condições']
    case 'next_steps':
      return Array.from({ length: count }, (_, i) => `Passo ${i + 1}`)
    case 'attachments':
      return Array.from({ length: count }, (_, i) => `Anexo ${i + 1} · nome`)
    case 'custom':
      return ['Título', 'Corpo']
  }
}
