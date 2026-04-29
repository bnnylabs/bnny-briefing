/**
 * Server-side PDF rendering for proposals.
 *
 * Uses @react-pdf/renderer (NOT puppeteer) because:
 *   - 100% serverless-friendly (no Chromium binary)
 *   - Vercel function size stays well under limits
 *   - Reproducible output across environments
 *
 * Trade-off: doesn't share CSS with the public web view. We re-implement
 * the layout here using @react-pdf primitives (<Page>, <View>, <Text>).
 * Visual reference: app/p/[slug]/page.tsx + the BlockReadOnly previews.
 *
 * The output mirrors the public page in spirit, not pixel-for-pixel.
 * It's optimized for print: A4, mono-friendly type, generous margins,
 * no decorative top strip (the mint band on screen would just waste ink).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type {
  ProposalBlock,
  BlockContentInvestment,
  BlockContentTerms,
  BlockContentNextSteps,
  BlockContentCustom,
  PaymentTerm,
  ProposalPhase,
} from '@/lib/proposal-types'
import type { StudioIdentity } from '@/lib/studio-identity'

// ─── Fonts ──────────────────────────────────────────────────────────────
//
// We use built-in PDF fonts (Helvetica, Courier) instead of registering
// custom ones. Trade-off: bundle stays small + no font-fetch latency,
// but we don't ship the brand mono font. For a commercial PDF this is
// acceptable — clients will see consistent system-like type.
//
// If we ever want JetBrains Mono / Geist Mono in the PDF, register
// here with Font.register({ family, src: <URL or buffer> }).

// ─── Colors ─────────────────────────────────────────────────────────────
// Subset of the brand palette translated to print-safe colors.
const COLORS = {
  text: '#111111',
  muted: '#666666',
  subtle: '#999999',
  border: '#e5e5e5',
  primary: '#12fea9', // Bnny mint
  primaryDark: '#06b87a',
  bg: '#ffffff',
  cardBg: '#fafafa',
  badgeBg: '#e8fff5', // light mint pill
} as const

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 56,
    backgroundColor: COLORS.bg,
    fontFamily: 'Helvetica',
    color: COLORS.text,
  },

  // Header (logo + proposal number)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.6,
    color: COLORS.text,
  },
  proposalLabel: {
    fontSize: 8,
    fontFamily: 'Courier-Bold',
    letterSpacing: 1.2,
    color: COLORS.muted,
    textAlign: 'right',
  },
  proposalNumber: {
    fontSize: 10,
    fontFamily: 'Courier-Bold',
    color: COLORS.text,
    textAlign: 'right',
    marginTop: 2,
  },

  // Title
  title: {
    fontSize: 28,
    fontFamily: 'Courier-Bold',
    letterSpacing: -0.5,
    color: COLORS.text,
    marginBottom: 24,
    marginTop: 8,
  },

  // Body sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.muted,
    marginBottom: 6,
  },

  // Header text (block content)
  headerBody: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.6,
  },
  paragraph: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.6,
    marginBottom: 8,
  },

  // Phase
  phase: {
    marginBottom: 20,
  },
  phaseNumber: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.muted,
    marginBottom: 4,
  },
  phaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  phaseTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
  },
  phaseDuration: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.text,
    backgroundColor: COLORS.badgeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  phaseDescription: {
    fontSize: 10.5,
    color: COLORS.muted,
    lineHeight: 1.55,
  },

  // Investment
  totalLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.muted,
    marginBottom: 4,
    marginTop: 8,
  },
  totalValue: {
    fontSize: 24,
    fontFamily: 'Courier-Bold',
    color: COLORS.text,
    marginBottom: 16,
  },

  // Payment terms grid
  termsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  termCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: COLORS.cardBg,
  },
  termLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  termDescription: {
    fontSize: 10,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
  termDiscountPill: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.primaryDark,
    backgroundColor: COLORS.badgeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
  },

  // Generic terms / next steps lists
  termsHeading: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  termsBody: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.6,
  },
  step: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  stepNumber: {
    fontSize: 9,
    fontFamily: 'Courier-Bold',
    color: COLORS.muted,
    width: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 10.5,
    color: COLORS.text,
    lineHeight: 1.5,
  },

  // Footer
  divider: {
    marginTop: 32,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  footerText: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.muted,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  footerDisclaimer: {
    fontSize: 8.5,
    fontFamily: 'Courier',
    color: COLORS.subtle,
    lineHeight: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  footerContacts: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  footerPill: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: COLORS.text,
    backgroundColor: COLORS.badgeBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  footerLine: {
    fontSize: 8.5,
    fontFamily: 'Courier',
    color: COLORS.subtle,
    marginTop: 8,
  },
})

// ─── i18n ───────────────────────────────────────────────────────────────
type Lang = 'pt-BR' | 'en-US'

function t(lang: Lang) {
  if (lang === 'en-US') {
    return {
      proposalLabel: 'PROPOSAL',
      total: 'TOTAL',
      paymentConditions: 'PAYMENT CONDITIONS',
      thanks: (studio: string) => `Thank you for considering ${studio}!`,
      validUntil: (date: string) => ` This estimate is valid through ${date}`,
      mayChange: ' and may change with scope adjustments.',
      contactUs: ' For questions, get in touch.',
      dateLocale: 'en-US',
    }
  }
  return {
    proposalLabel: 'ORÇAMENTO',
    total: 'TOTAL',
    paymentConditions: 'CONDIÇÕES DE PAGAMENTO',
    thanks: (studio: string) => `Obrigado por considerar a ${studio}!`,
    validUntil: (date: string) => ` Esta estimativa é válida até ${date}`,
    mayChange: ' e pode variar com mudanças no escopo.',
    contactUs: ' Para dúvidas, entre em contato conosco.',
    dateLocale: 'pt-BR',
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang === 'en-US' ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: currency || (lang === 'en-US' ? 'USD' : 'BRL'),
    }).format(amount)
  } catch {
    return `${currency || 'R$'} ${amount.toLocaleString()}`
  }
}

/**
 * Strip the most common Markdown markers without dragging in a parser.
 * The PDF renderer doesn't support markdown — and we don't need full
 * fidelity, just clean text. Heuristic strip handles bold/italic/links/
 * headings/lists which cover ~95% of what owners write.
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/^#+\s+/gm, '') // headers
    .replace(/^[-*]\s+/gm, '• ') // bullet lists → bullets
    .trim()
}

function formatLocation(s: StudioIdentity): string | null {
  const parts = [s.city, s.state].filter(Boolean).join(', ')
  if (!parts && !s.country) return null
  if (!parts) return s.country
  if (!s.country) return parts
  return `${parts} — ${s.country}`
}

// ─── Block renderers ────────────────────────────────────────────────────

function HeaderBlock({ body }: { body: string }) {
  if (!body?.trim()) return null
  const paragraphs = body.split(/\n\n+/).filter(Boolean)
  return (
    <View style={styles.section}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {p.trim()}
        </Text>
      ))}
    </View>
  )
}

function PhasesBlock({ phases }: { phases: ProposalPhase[] }) {
  if (!phases?.length) return null
  return (
    <View style={styles.section}>
      {phases
        .filter((p) => p.visible !== false)
        .map((p, i) => (
          <View key={i} style={styles.phase} wrap={false}>
            <Text style={styles.phaseNumber}>{p.number}</Text>
            <View style={styles.phaseTitleRow}>
              <Text style={styles.phaseTitle}>{p.title}</Text>
              {p.duration && (
                <Text style={styles.phaseDuration}>{p.duration}</Text>
              )}
            </View>
            {p.description && (
              <Text style={styles.phaseDescription}>{p.description}</Text>
            )}
          </View>
        ))}
    </View>
  )
}

function InvestmentBlock({
  content,
  i18n,
  lang,
}: {
  content: BlockContentInvestment
  i18n: ReturnType<typeof t>
  lang: Lang
}) {
  const total = content.total_amount ?? 0
  const currency = content.currency || (lang === 'en-US' ? 'USD' : 'BRL')
  const terms = (content.payment_terms ?? []) as PaymentTerm[]
  return (
    <View style={styles.section}>
      <Text style={styles.totalLabel}>{i18n.total}</Text>
      <Text style={styles.totalValue}>
        {formatCurrency(total, currency, lang)}
      </Text>
      {terms.length > 0 && (
        <View style={styles.termsRow}>
          {terms.map((term, i) => {
            // discount_percent is only defined on the 'text' variant of
            // PaymentTerm. The 'pix' / future variants don't have it.
            // Narrow before dereferencing to keep TS happy and avoid
            // ever rendering "undefined%" on screen.
            const discount =
              term.type === 'text' && typeof term.discount_percent === 'number'
                ? term.discount_percent
                : null
            return (
              <View key={i} style={styles.termCard}>
                <Text style={styles.termLabel}>{term.label || '—'}</Text>
                {term.description && (
                  <Text style={styles.termDescription}>{term.description}</Text>
                )}
                {discount !== null && discount > 0 && (
                  <Text style={styles.termDiscountPill}>
                    {discount}% {lang === 'en-US' ? 'off' : 'de desconto'}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function TermsBlock({ content }: { content: BlockContentTerms }) {
  if (!content.body_markdown?.trim()) return null
  return (
    <View style={styles.section} wrap={true}>
      <Text style={styles.termsBody}>{stripMarkdown(content.body_markdown)}</Text>
    </View>
  )
}

function NextStepsBlock({ content }: { content: BlockContentNextSteps }) {
  if (!content.items?.length) return null
  return (
    <View style={styles.section} wrap={false}>
      {content.items.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepNumber}>{i + 1}.</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  )
}

function CustomBlock({ content }: { content: BlockContentCustom }) {
  if (!content.body_markdown?.trim()) return null
  return (
    <View style={styles.section} wrap={true}>
      {content.title && <Text style={styles.termsHeading}>{content.title}</Text>}
      <Text style={styles.termsBody}>{stripMarkdown(content.body_markdown)}</Text>
    </View>
  )
}

function BlockRenderer({
  block,
  i18n,
  lang,
}: {
  block: ProposalBlock
  i18n: ReturnType<typeof t>
  lang: Lang
}) {
  switch (block.type) {
    case 'header':
      return <HeaderBlock body={(block.content as { body: string }).body} />
    case 'phases':
      return (
        <PhasesBlock
          phases={(block.content as { phases: ProposalPhase[] }).phases ?? []}
        />
      )
    case 'investment':
      return (
        <InvestmentBlock
          content={block.content as BlockContentInvestment}
          i18n={i18n}
          lang={lang}
        />
      )
    case 'terms':
      return <TermsBlock content={block.content as BlockContentTerms} />
    case 'next_steps':
      return <NextStepsBlock content={block.content as BlockContentNextSteps} />
    case 'custom':
      return <CustomBlock content={block.content as BlockContentCustom} />
    case 'attachments':
      // Attachments are file lists — translating to PDF doesn't add
      // value. Skip silently.
      return null
    default:
      return null
  }
}

// ─── Footer ─────────────────────────────────────────────────────────────

function Footer({
  studio,
  validUntil,
  i18n,
}: {
  studio: StudioIdentity
  validUntil: string | null
  i18n: ReturnType<typeof t>
}) {
  const location = formatLocation(studio)
  return (
    <View>
      <View style={styles.divider} />
      <Text style={styles.footerText}>
        {i18n.thanks(studio.studio_name)}
        {validUntil && i18n.validUntil(validUntil)}
        {validUntil && i18n.mayChange}
        {!validUntil && i18n.contactUs}
      </Text>
      {studio.footer_disclaimer && (
        <Text style={styles.footerDisclaimer}>
          {stripMarkdown(studio.footer_disclaimer)}
        </Text>
      )}
      <View style={styles.footerContacts}>
        {studio.phone_contact && (
          <Text style={styles.footerPill}>{studio.phone_contact}</Text>
        )}
        <Text style={styles.footerPill}>{studio.email_contact}</Text>
      </View>
      {location && (
        <Text style={styles.footerLine}>
          {studio.studio_name} · {location}
          {studio.cnpj && ` · CNPJ ${studio.cnpj}`}
        </Text>
      )}
    </View>
  )
}

// ─── Document ───────────────────────────────────────────────────────────

export interface ProposalPdfData {
  title: string
  proposalNumber: string
  studio: StudioIdentity
  blocks: ProposalBlock[]
  validUntil: string | null // formatted date string in target locale
  lang: Lang
}

export function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const i18n = t(data.lang)
  const visibleBlocks = data.blocks.filter((b) => b.visible !== false)

  return (
    <Document
      title={`${data.proposalNumber} · ${data.title}`}
      author={data.studio.studio_name}
      creator={data.studio.studio_name}
      producer={data.studio.studio_name}
    >
      <Page size="A4" style={styles.page}>
        {/* Top: logo + proposal number */}
        <View style={styles.header} fixed>
          <Text style={styles.logoText}>{data.studio.studio_name}</Text>
          <View>
            <Text style={styles.proposalLabel}>{i18n.proposalLabel}</Text>
            <Text style={styles.proposalNumber}>{data.proposalNumber}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{data.title}</Text>

        {/* Blocks */}
        {visibleBlocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            i18n={i18n}
            lang={data.lang}
          />
        ))}

        {/* Footer */}
        <Footer studio={data.studio} validUntil={data.validUntil} i18n={i18n} />
      </Page>
    </Document>
  )
}
