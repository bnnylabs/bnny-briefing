/**
 * Translation engine — Phase G (IA Ambiental).
 *
 * Lê um bloco/proposta no idioma-fonte e produz uma tradução em outro
 * idioma. Resultado é gravado nas colunas `translations` + `translations_meta`
 * adicionadas pela schema-v16 — o `content` original NUNCA é substituído.
 *
 * Resolve o bug em que `?l=en` na recipient view só trocava a UI: agora a
 * view consegue ler o conteúdo já traduzido e cair em fallback pro source
 * apenas quando a tradução não existe (ou está stale).
 *
 * ─── Estratégia: extract → translate → reconstruct ─────────────────────
 *
 * Em vez de mandar a IA gerar JSON com o shape exato do bloco e torcer pra
 * não quebrar, fazemos:
 *   1. Extrai SÓ as strings traduzíveis do `content`, em ordem fixa.
 *   2. Pede pra IA traduzir esse array de strings (tool_use estrito).
 *   3. Reconstrói o `content` localmente, costurando as strings de volta
 *      nos slots originais.
 *
 * Vantagens:
 *   - Shape nunca quebra (IA não controla estrutura, só texto).
 *   - Schema da tool é único e simples (uma lista de strings).
 *   - Campos não-traduzíveis (URLs, números, IDs) ficam intactos.
 *   - Adicionar novo tipo de bloco = só implementar extract/reconstruct,
 *     a engine de tradução não muda.
 *
 * ─── Hash & staleness ──────────────────────────────────────────────────
 *
 * Toda tradução guarda um `source_hash` calculado sobre o JSON canônico
 * (chaves ordenadas) do `content`-fonte no momento da tradução. Quando o
 * operador edita o source depois, o hash diverge → UI marca como "stale".
 * Decisão de retraduzir é manual (evita custo silencioso e perda de
 * revisões manuais que o operador possa ter aplicado).
 */

import { createHash } from 'crypto'
import { anthropic } from '@/lib/anthropic'
import { STUDIO_IDENTITY_PT } from '@/lib/ai-style-rules'
import type {
  BlockContentAttachments,
  BlockContentCustom,
  BlockContentHeader,
  BlockContentInvestment,
  BlockContentNextSteps,
  BlockContentPhases,
  BlockContentTerms,
  PaymentTerm,
  ProposalBlock,
  ProposalBlockContent,
  ProposalBlockType,
  ProposalLanguage,
  ProposalScalars,
  TranslationMeta,
  TranslationsByLang,
  TranslationsMetaByLang,
  TranslationStatus,
} from '@/lib/proposal-types'

// ─── Public types (re-exports) ──────────────────────────────────────────
//
// Translation domain types live in proposal-types.ts (canonical source) so
// that Proposal/ProposalBlock/ProposalTemplate can reference them without
// circular imports. We re-export here to keep this module's public API
// stable — existing callers (the v0.10.92 endpoints) import from
// '@/lib/translate' and shouldn't have to change.

export type Lang = ProposalLanguage
export type {
  TranslationStatus,
  TranslationMeta,
  TranslationsByLang,
  TranslationsMetaByLang,
  ProposalScalars,
}

// ─── Hash ───────────────────────────────────────────────────────────────

/**
 * JSON canônico — chaves ordenadas em qualquer profundidade — pra que o
 * mesmo content sempre produza o mesmo hash mesmo que a ordem de chaves
 * mude por causa do banco/serialização.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']'
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(
    (k) =>
      JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k]),
  )
  return '{' + parts.join(',') + '}'
}

/**
 * Hash determinístico do content-fonte. Usado pra:
 *   - guardar em translations_meta no momento da tradução
 *   - comparar depois pra detectar stale
 */
export function computeContentHash(content: unknown): string {
  return createHash('sha256').update(canonicalJson(content)).digest('hex')
}

// ─── Status ─────────────────────────────────────────────────────────────

/**
 * Determina o status de uma tradução para um idioma específico.
 *   - missing: não existe tradução p/ esse idioma
 *   - fresh:   tradução existe e o hash bate com o source atual
 *   - stale:   tradução existe mas o source mudou desde então
 */
export function getTranslationStatus(
  sourceContent: unknown,
  translations: TranslationsByLang<unknown> | null | undefined,
  translationsMeta: TranslationsMetaByLang | null | undefined,
  lang: Lang,
): TranslationStatus {
  const has = translations && translations[lang] !== undefined
  if (!has) return 'missing'
  const meta = translationsMeta?.[lang]
  if (!meta) return 'stale' // tradução sem meta = trata como stale por segurança
  const currentHash = computeContentHash(sourceContent)
  return meta.source_hash === currentHash ? 'fresh' : 'stale'
}

/**
 * Lê o content correto pra um idioma de display.
 * Se o display = source, devolve o source.
 * Se há tradução fresh ou stale, devolve a tradução (com flag).
 * Se não há tradução, devolve null (caller decide fallback).
 */
export function readTranslatedContent<T>(
  sourceContent: T,
  sourceLang: Lang,
  translations: TranslationsByLang<T> | null | undefined,
  translationsMeta: TranslationsMetaByLang | null | undefined,
  displayLang: Lang,
): { content: T; lang: Lang; status: TranslationStatus } {
  if (displayLang === sourceLang) {
    return { content: sourceContent, lang: sourceLang, status: 'fresh' }
  }
  const status = getTranslationStatus(
    sourceContent,
    translations,
    translationsMeta,
    displayLang,
  )
  if (status === 'missing') {
    return { content: sourceContent, lang: sourceLang, status: 'missing' }
  }
  return {
    content: translations![displayLang] as T,
    lang: displayLang,
    status,
  }
}

// ─── Extract / reconstruct por tipo de bloco ────────────────────────────
//
// Cada extractor devolve { strings, reconstruct } onde:
//   - strings: array das strings traduzíveis na ordem que vão pro modelo
//   - reconstruct(translated): pega o array traduzido e devolve o content
//     com as strings novas costuradas de volta — campos não-textuais
//     (números, URLs, currency code) ficam exatamente como no source.

interface Extractor<T extends ProposalBlockContent> {
  strings: string[]
  reconstruct: (translated: string[]) => T
}

function extractHeader(c: BlockContentHeader): Extractor<BlockContentHeader> {
  return {
    strings: [c.body ?? ''],
    reconstruct: ([body]) => ({ body: body ?? '' }),
  }
}

function extractPhases(c: BlockContentPhases): Extractor<BlockContentPhases> {
  const phases = Array.isArray(c.phases) ? c.phases : []
  // Cada fase contribui 3 strings: title, duration, description.
  // O `number` ("1.0", "2.0") fica intacto — não é texto de prosa.
  const strings: string[] = []
  for (const p of phases) {
    strings.push(p.title ?? '', p.duration ?? '', p.description ?? '')
  }
  return {
    strings,
    reconstruct: (t) => ({
      phases: phases.map((p, i) => ({
        number: p.number ?? '',
        title: t[i * 3] ?? '',
        duration: t[i * 3 + 1] ?? '',
        description: t[i * 3 + 2] ?? '',
        ...(p.visible !== undefined ? { visible: p.visible } : {}),
      })),
    }),
  }
}

function extractInvestment(
  c: BlockContentInvestment,
): Extractor<BlockContentInvestment> {
  // Campos textuais: intro + cada payment_term.label e payment_term.description.
  // Números (total_amount, currency, discount_percent), URLs e tipo ficam intactos.
  const terms = Array.isArray(c.payment_terms) ? c.payment_terms : []
  const strings: string[] = [c.intro ?? '']
  for (const t of terms) {
    strings.push(t.label ?? '', (t as { description?: string }).description ?? '')
  }
  return {
    strings,
    reconstruct: (t) => ({
      intro: t[0] ?? '',
      total_amount: c.total_amount ?? 0,
      currency: c.currency ?? 'BRL',
      payment_terms: terms.map((term, i): PaymentTerm => {
        const newLabel = t[1 + i * 2] ?? term.label ?? ''
        const newDesc = t[1 + i * 2 + 1] ?? ''
        // Mantém todos os campos não-textuais do termo intactos
        return { ...term, label: newLabel, description: newDesc } as PaymentTerm
      }),
    }),
  }
}

function extractTerms(c: BlockContentTerms): Extractor<BlockContentTerms> {
  return {
    strings: [c.body_markdown ?? ''],
    reconstruct: ([md]) => ({ body_markdown: md ?? '' }),
  }
}

function extractNextSteps(
  c: BlockContentNextSteps,
): Extractor<BlockContentNextSteps> {
  const items = Array.isArray(c.items) ? c.items : []
  return {
    strings: [...items],
    reconstruct: (t) => ({ items: items.map((_, i) => t[i] ?? '') }),
  }
}

function extractAttachments(
  c: BlockContentAttachments,
): Extractor<BlockContentAttachments> {
  // Anexos têm `name` (traduzível) e `url` (não traduzível).
  const files = Array.isArray(c.files) ? c.files : []
  return {
    strings: files.map((f) => f.name ?? ''),
    reconstruct: (t) => ({
      files: files.map((f, i) => ({ name: t[i] ?? '', url: f.url ?? '' })),
    }),
  }
}

function extractCustom(c: BlockContentCustom): Extractor<BlockContentCustom> {
  return {
    strings: [c.title ?? '', c.body_markdown ?? ''],
    reconstruct: ([title, md]) => ({
      title: title ?? '',
      body_markdown: md ?? '',
    }),
  }
}

/**
 * Dispatcher — escolhe o extractor correto pelo tipo do bloco.
 * Tipos novos no futuro só precisam de uma entrada aqui.
 */
function extractTranslatable(
  type: ProposalBlockType,
  content: ProposalBlockContent,
): Extractor<ProposalBlockContent> {
  switch (type) {
    case 'header':
      return extractHeader(content as BlockContentHeader) as Extractor<ProposalBlockContent>
    case 'phases':
      return extractPhases(content as BlockContentPhases) as Extractor<ProposalBlockContent>
    case 'investment':
      return extractInvestment(content as BlockContentInvestment) as Extractor<ProposalBlockContent>
    case 'terms':
      return extractTerms(content as BlockContentTerms) as Extractor<ProposalBlockContent>
    case 'next_steps':
      return extractNextSteps(content as BlockContentNextSteps) as Extractor<ProposalBlockContent>
    case 'attachments':
      return extractAttachments(content as BlockContentAttachments) as Extractor<ProposalBlockContent>
    case 'custom':
      return extractCustom(content as BlockContentCustom) as Extractor<ProposalBlockContent>
  }
}

// ─── Tradução via Anthropic ─────────────────────────────────────────────

const TRANSLATION_MODEL = 'claude-haiku-4-5'

/** Tool schema único: recebe array, devolve array do mesmo tamanho. */
const TRANSLATE_TOOL = {
  name: 'translate_strings',
  description:
    'Devolve o array de strings traduzido. O array de saída TEM que ter exatamente o mesmo número de elementos do array de entrada, na mesma ordem.',
  input_schema: {
    type: 'object' as const,
    properties: {
      translations: {
        type: 'array',
        description:
          'Array de strings traduzidas, na MESMA ORDEM e com o MESMO TAMANHO do array de entrada. Strings vazias na entrada devem virar strings vazias na saída.',
        items: { type: 'string' },
      },
    },
    required: ['translations'],
  },
}

interface TranslateToolOutput {
  translations: string[]
}

const LANG_LABEL: Record<Lang, string> = {
  'pt-BR': 'português brasileiro',
  'en-US': 'inglês americano (en-US)',
}

/**
 * Monta o prompt de tradução. Reusa identidade do estúdio só quando o
 * destino é PT (anti-cliché PT-BR não se aplica a en-US).
 */
function buildTranslationPrompt(
  fromLang: Lang,
  toLang: Lang,
  blockType: ProposalBlockType,
  strings: string[],
): string {
  const identity =
    toLang === 'pt-BR'
      ? STUDIO_IDENTITY_PT
      : 'You translate proposal copy for Bnny Labs, a creative studio. Voice: professional, direct, human. Avoid corporate buzzwords and AI-flavored phrasing ("leverage", "robust", "transformative journey", etc.).'

  const arrayPreview = strings
    .map((s, i) => `[${i}] ${JSON.stringify(s)}`)
    .join('\n')

  return `${identity}

Sua tarefa: traduzir um array de strings de um bloco de proposta do tipo "${blockType}", de ${LANG_LABEL[fromLang]} para ${LANG_LABEL[toLang]}.

REGRAS:
1. PRESERVE markdown se houver (## títulos, **negrito**, listas com - ou *, links [text](url)).
2. PRESERVE placeholders entre colchetes: [Cliente], [Project Name], etc.
3. NÃO traduza nomes próprios (Bnny Labs, nomes de pessoas, marcas).
4. NÃO invente conteúdo novo. Se a string original é vazia, devolve string vazia.
5. NÃO faça localização cultural (datas, moedas, formatos) — só linguística.
6. MANTENHA o tom: profissional, direto, humano. Sem corporativês, sem "we are excited to", sem "transformative journey".
7. NÚMEROS e códigos (1.0, 2.0, BRL, USD) ficam intactos quando aparecerem dentro do texto.
8. O array de saída TEM que ter exatamente ${strings.length} elementos, na mesma ordem.

ARRAY DE ENTRADA (${strings.length} strings):
${arrayPreview}

Agora chama a tool translate_strings com o array traduzido.`
}

export interface TranslateBlockResult {
  /** Content traduzido, mesmo shape do source. */
  translated: ProposalBlockContent
  /** Metadata pra gravar em translations_meta[lang]. */
  meta: TranslationMeta
}

/**
 * Traduz o content de um bloco de `fromLang` para `toLang`.
 *
 * Não persiste — devolve o resultado pro caller (API route) gravar.
 * Se o bloco não tem strings traduzíveis (ex: attachments só com URLs),
 * devolve content idêntico ao source com meta válida.
 */
export async function translateBlock(
  block: Pick<ProposalBlock, 'type' | 'content'>,
  fromLang: Lang,
  toLang: Lang,
): Promise<TranslateBlockResult> {
  if (fromLang === toLang) {
    throw new Error('translateBlock: fromLang and toLang are equal')
  }

  const sourceHash = computeContentHash(block.content)
  const extractor = extractTranslatable(block.type, block.content)

  // Caminho rápido: nada pra traduzir (ex: attachments com 0 arquivos)
  const hasContent = extractor.strings.some((s) => s && s.trim().length > 0)
  if (!hasContent) {
    return {
      translated: extractor.reconstruct(extractor.strings),
      meta: {
        source_hash: sourceHash,
        translated_at: new Date().toISOString(),
        translated_by: 'ai',
        model: TRANSLATION_MODEL,
      },
    }
  }

  const prompt = buildTranslationPrompt(fromLang, toLang, block.type, extractor.strings)

  const msg = await anthropic.messages.create({
    model: TRANSLATION_MODEL,
    max_tokens: 4096,
    tools: [TRANSLATE_TOOL],
    tool_choice: { type: 'tool', name: 'translate_strings' },
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = msg.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('IA não retornou chamada de tool válida')
  }

  const out = toolUse.input as TranslateToolOutput
  if (!Array.isArray(out.translations)) {
    throw new Error('Tool input.translations não é array')
  }

  // Normaliza tamanho: se a IA devolveu mais ou menos itens, padding/trim
  // pro tamanho original. Item faltante vira a string original (fallback
  // mais seguro do que vazio).
  const expected = extractor.strings.length
  const fixed: string[] = []
  for (let i = 0; i < expected; i++) {
    const v = out.translations[i]
    fixed.push(typeof v === 'string' ? v : extractor.strings[i])
  }

  const translated = extractor.reconstruct(fixed)

  return {
    translated,
    meta: {
      source_hash: sourceHash,
      translated_at: new Date().toISOString(),
      translated_by: 'ai',
      model: TRANSLATION_MODEL,
    },
  }
}

// ─── Tradução de campos top-level da proposta ───────────────────────────
//
// `proposals.title` e `proposals.payment_terms` ficam fora dos blocks e
// também precisam ser traduzidos. Mesmo padrão.

export interface TranslateProposalScalarsResult {
  translated: ProposalScalars
  meta: TranslationMeta
}

export async function translateProposalScalars(
  scalars: ProposalScalars,
  fromLang: Lang,
  toLang: Lang,
): Promise<TranslateProposalScalarsResult> {
  if (fromLang === toLang) {
    throw new Error('translateProposalScalars: fromLang and toLang are equal')
  }

  const sourceHash = computeContentHash(scalars)
  const terms = Array.isArray(scalars.payment_terms) ? scalars.payment_terms : []

  // Strings: [title, ...(label, description) por termo]
  const strings: string[] = [scalars.title ?? '']
  for (const t of terms) {
    strings.push(t.label ?? '', (t as { description?: string }).description ?? '')
  }

  const hasContent = strings.some((s) => s && s.trim().length > 0)
  if (!hasContent) {
    return {
      translated: scalars,
      meta: {
        source_hash: sourceHash,
        translated_at: new Date().toISOString(),
        translated_by: 'ai',
        model: TRANSLATION_MODEL,
      },
    }
  }

  const prompt = buildTranslationPrompt(fromLang, toLang, 'investment', strings)

  const msg = await anthropic.messages.create({
    model: TRANSLATION_MODEL,
    max_tokens: 2048,
    tools: [TRANSLATE_TOOL],
    tool_choice: { type: 'tool', name: 'translate_strings' },
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = msg.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('IA não retornou chamada de tool válida')
  }

  const out = toolUse.input as TranslateToolOutput
  if (!Array.isArray(out.translations)) {
    throw new Error('Tool input.translations não é array')
  }

  const expected = strings.length
  const fixed: string[] = []
  for (let i = 0; i < expected; i++) {
    const v = out.translations[i]
    fixed.push(typeof v === 'string' ? v : strings[i])
  }

  const translated: ProposalScalars = {
    title: fixed[0] ?? '',
    payment_terms: terms.map((term, i): PaymentTerm => {
      const newLabel = fixed[1 + i * 2] ?? term.label ?? ''
      const newDesc = fixed[1 + i * 2 + 1] ?? ''
      return { ...term, label: newLabel, description: newDesc } as PaymentTerm
    }),
  }

  return {
    translated,
    meta: {
      source_hash: sourceHash,
      translated_at: new Date().toISOString(),
      translated_by: 'ai',
      model: TRANSLATION_MODEL,
    },
  }
}
