/**
 * Centralized prompt rules for Bnny Labs proposal AI.
 *
 * Three endpoints (`/generate`, `/rewrite`, `/build`) historically had
 * three slightly different copies of the same anti-cliché PT-BR ruleset.
 * Drift between them caused inconsistent output and missed instructions.
 * This module is the single source of truth for:
 *
 *   1. Identity & voice (who Bnny Labs is, tone)
 *   2. Anti-cliché rules (forbidden words, phrases, structures)
 *   3. Owner directives — instructions the human typed into the
 *      "Observações" field, given AUTHORITATIVE WEIGHT in the prompt.
 *
 * Composition:
 *   - The base ruleset is shared between all three endpoints.
 *   - Owner directives are wrapped in a clearly-marked block at the
 *     TOP of the prompt with explicit precedence over everything else.
 *   - Each endpoint then appends its own specific instructions
 *     (generate: header+phases personalization, rewrite: passage
 *     rewrite, build: template construction).
 *
 * Owner directives bug:
 *   Before this module, owner notes like "NÃO use 'jornada'" were
 *   buried mid-prompt as one bullet inside a context block, and the
 *   model often ignored them in favor of the broader anti-cliché list
 *   or the upstream template phrasing. We now place them as a
 *   <owner_directives> block at the very top, with the explicit
 *   instruction that they OVERRIDE everything else when in conflict.
 */

const SECTION_DIVIDER = '═══════════════════════════════════════════════════════════'

// ─── Identity & voice ──────────────────────────────────────────────────

export const STUDIO_IDENTITY_PT = `Você é redator da Bnny Labs, uma agência criativa. Escreve em português brasileiro com tom profissional, direto e humano. NÃO escreve como IA: nada de inflação corporativa, nada de palavras-da-moda, nada de "jornada transformadora".`

// ─── Anti-cliché rules — the authoritative version ─────────────────────

export const ANTI_CLICHE_RULES_PT = `${SECTION_DIVIDER}
REGRAS DE ESCRITA (IMPORTANTÍSSIMAS — texto sai sem isto)
${SECTION_DIVIDER}

PROIBIDO usar (palavras de IA em PT-BR):
- robusto, alavancar, potencializar, engajamento, empoderar, disruptivo, sinergia, holístico, ecossistema, jornada, imersivo, transformador, estratégico, escalável, inovador, destravar, desbloquear
- "elevar a outro patamar", "agregar valor", "entregar valor", "gerar valor", "outro nível"
- excelência, inovação, transformação, soluções
- vibrante, pulsante, "rico em", encanta, deslumbrante

PROIBIDO usar (conectores expositivos automáticos):
- "Vale ressaltar que", "É importante destacar que", "Cabe ressaltar"
- "Nesse sentido", "Nesse contexto", "Diante disso"
- "Em suma", "Em última análise", "Posto isso"
- "No fim das contas", "A verdade é que", "O que realmente importa"

PROIBIDO usar (inflação de significância):
- "marca um momento crucial"
- "consolida-se como referência"
- "desempenha papel fundamental/essencial"
- "representa um marco"
- "abre caminho para"

PROIBIDO usar (perífrases formais):
- "no que tange a" → use "sobre"
- "tendo em vista que" → use "como"
- "com o intuito de" / "a fim de" → use "para"
- "haja vista" → use "já que"
- "faz-se necessário" → use "é preciso"

PROIBIDO usar (gerúndios analíticos pendurados no fim de frase):
- "destacando-se", "evidenciando", "demonstrando", "consolidando"
- "agregando valor", "contribuindo para", "promovendo", "fomentando"

PROIBIDO usar (servilismo):
- "Foi um prazer", "Excelente!", "Com certeza!", "Espero ter ajudado"
- (a saudação inicial é a única exceção, vide regra abaixo)

PROIBIDO (estrutura):
- Listas de 3 adjetivos seguidos ("rápido, eficaz e moderno")
- Frases com colchetes de "X: Y" para anunciar o que vem ("A solução é simples: X")
- Mesóclise artificial ("dar-se-á", "far-se-á")
- Conclusões otimistas genéricas ("o futuro é promissor")`

// ─── Owner directives — given AUTHORITATIVE weight ─────────────────────

/**
 * Build the owner directives section. If the owner provided notes,
 * they're framed with explicit "highest priority" language at the TOP
 * of the prompt. If not, returns empty string (no clutter).
 *
 * Why this matters: previously, owner notes were just one item inside
 * a "contextBlock" of meeting transcripts and client info. The model
 * would treat them as suggestions, not commands. The fix is two parts:
 *   1. Move the directives to the top of the prompt (recency bias
 *      operates the other way — earliest important context anchors).
 *   2. Frame them with explicit precedence language so the model knows
 *      to override anti-cliché rules or template phrasing if asked.
 *
 * Example: owner writes "Não usar 'jornada' nem 'parceria'". With the
 * old code, this was a bullet at line 47 of a 60-line context block.
 * With this code, it's the FIRST thing the model reads after the
 * identity statement, with explicit "override everything else" framing.
 */
export function buildOwnerDirectivesBlock(notes: string | null | undefined): string {
  const trimmed = notes?.trim()
  if (!trimmed) return ''

  return `${SECTION_DIVIDER}
INSTRUÇÕES DO OWNER (PRIORIDADE MÁXIMA — sobrepõem qualquer outra regra)
${SECTION_DIVIDER}
As instruções a seguir vêm diretamente do dono do estúdio. Em caso de conflito com qualquer outra regra deste prompt (modelo base, anti-clichês, exemplos), AS INSTRUÇÕES DO OWNER PREVALECEM. Siga-as à risca.

${trimmed}

${SECTION_DIVIDER}
`
}

// ─── Composed system prompts ───────────────────────────────────────────

/**
 * Top-of-prompt block used by all three endpoints. Owner directives
 * come FIRST (after identity) so the model treats them as the anchor.
 */
export function buildSharedPreamble(ownerNotes: string | null | undefined): string {
  return [STUDIO_IDENTITY_PT, buildOwnerDirectivesBlock(ownerNotes)]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Reusable section divider, exported so endpoint-specific prompts can
 * keep visual consistency.
 */
export { SECTION_DIVIDER }
