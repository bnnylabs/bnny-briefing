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
  Svg,
  Path,
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
// Geist Mono is registered lazily — once per process, idempotent. The
// font files live in /public/fonts/ (committed in v0.10.84) and are
// fetched by Font.register over HTTP using the request's origin URL
// resolved by the API route. We can't hardcode the URL because:
//   - localhost dev runs on http://localhost:3000
//   - production runs on https://briefing.bnnylabs.com
//   - each Vercel preview gets a unique URL
// So registerFonts() is exported and called from the route with the
// concrete origin in hand.
//
// On Font.register failure (network blip, font file missing), the PDF
// renderer falls back to whatever the next available family is in the
// stack. Since fontFamily on each style includes 'Helvetica' as the
// final fallback, the worst case is "PDF still works, looks like before".

const FONT_FAMILY_MONO = 'GeistMono'

let fontsRegistered = false

/**
 * Register Geist Mono once per process. Safe to call repeatedly —
 * subsequent calls are no-ops. Pass the absolute origin (https://host)
 * so Font.register can fetch the .woff2 from /public/fonts/.
 */
export function registerFonts(origin: string) {
  if (fontsRegistered) return
  try {
    Font.register({
      family: FONT_FAMILY_MONO,
      fonts: [
        { src: `${origin}/fonts/GeistMono-Regular.woff2`, fontWeight: 400 },
        { src: `${origin}/fonts/GeistMono-Bold.woff2`, fontWeight: 700 },
      ],
    })
    fontsRegistered = true
  } catch (e) {
    // Don't throw — better to render with Helvetica than fail the PDF.
    // The error is logged so we notice in production logs.
    console.error('[proposal-pdf] Font.register failed:', e)
  }
}

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
  proposalLabel: {
    fontSize: 8,
    fontFamily: 'GeistMono',
    fontWeight: 700,
    letterSpacing: 1.2,
    color: COLORS.muted,
    textAlign: 'right',
  },
  proposalNumber: {
    fontSize: 10,
    fontFamily: 'GeistMono',
    fontWeight: 700,
    color: COLORS.text,
    textAlign: 'right',
    marginTop: 2,
  },

  // Title
  title: {
    fontSize: 28,
    fontFamily: 'GeistMono',
    fontWeight: 700,
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
    fontFamily: 'GeistMono',
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
    fontFamily: 'GeistMono',
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
    fontFamily: 'GeistMono',
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
    fontFamily: 'GeistMono',
    color: COLORS.muted,
    marginBottom: 4,
    marginTop: 8,
  },
  totalValue: {
    fontSize: 24,
    fontFamily: 'GeistMono',
    fontWeight: 700,
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
    fontFamily: 'GeistMono',
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
    fontFamily: 'GeistMono',
    fontWeight: 700,
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
    fontFamily: 'GeistMono',
    color: COLORS.muted,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  footerDisclaimer: {
    fontSize: 8.5,
    fontFamily: 'GeistMono',
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
    fontFamily: 'GeistMono',
    color: COLORS.text,
    backgroundColor: COLORS.badgeBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  footerLine: {
    fontSize: 8.5,
    fontFamily: 'GeistMono',
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

// ─── Brand logo ─────────────────────────────────────────────────────────
//
// Bnny Labs wordmark — 7 paths, viewBox 217×135. Mirrored from
// components/brand/Logo.tsx so the PDF carries the actual mark instead
// of the studio name as plain Helvetica text.
//
// Sized at ~80×50 in the PDF — that's about half the on-screen header
// size, calibrated for A4 print where the page is the foreground.
//
// Color is hardcoded to COLORS.text (vs `currentColor` on web) because
// @react-pdf/renderer's <Svg> doesn't propagate parent text color the
// same way browsers do. Using a literal keeps the result predictable.
function BnnyLogo({ width = 80, height = 50 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 217 135">
      <Path
        d="M48.5028 45.4325C48.5028 48.0723 47.9805 50.3654 46.9319 52.3157C45.8832 54.266 44.4537 55.8854 42.6353 57.1777C40.817 58.47 38.6962 59.4432 36.273 60.1051C33.8498 60.7671 31.2853 61.0941 28.5872 61.0941H0V0H32.6363C34.6746 0 36.5204 0.460983 38.1739 1.37507C39.8273 2.2931 41.2293 3.48298 42.3879 4.94474C43.5465 6.40649 44.438 8.07312 45.0742 9.93675C45.7065 11.8004 46.0246 13.7113 46.0246 15.6577C46.0246 18.5851 45.3216 21.3353 43.9156 23.9199C42.5097 26.5006 40.4046 28.4509 37.5926 29.7709C40.9505 30.8031 43.6093 32.6392 45.5651 35.279C47.521 37.9188 48.4989 41.3033 48.4989 45.4325H48.5028ZM13.5494 12.0486V24.6961H26.8513C28.3398 24.6961 29.6594 24.18 30.8179 23.1477C31.9765 22.1154 32.5538 20.5078 32.5538 18.329C32.5538 16.3235 32.0433 14.7712 31.0261 13.6837C30.005 12.5963 28.7796 12.0486 27.3501 12.0486H13.5494ZM34.7021 42.5956C34.7021 40.7044 34.1797 39.0969 33.1311 37.777C32.0825 36.4571 30.7629 35.7991 29.1645 35.7991H13.5494V49.1361H28.5872C30.3506 49.1361 31.8115 48.5333 32.9662 47.3276C34.1248 46.122 34.7021 44.546 34.7021 42.5956Z"
        fill={COLORS.text}
      />
      <Path
        d="M65.4748 26.1578V61.0941H52.5028V0H65.4748L87.2049 35.8818V0H100.177V61.0941H87.2049L65.4748 26.1578Z"
        fill={COLORS.text}
      />
      <Path
        d="M117.149 26.1578V61.0941H104.177V0H117.149L138.879 35.8818V0H151.851V61.0941H138.879L117.149 26.1578Z"
        fill={COLORS.text}
      />
      <Path
        d="M168.522 0.256104L181.533 28.0727L194.721 0.256104H208.479L186.961 40.1883V60.838H176.027V40.0189L154.851 0.256104H168.526H168.522Z"
        fill={COLORS.text}
      />
      <Path
        d="M0 134.62V74.0386H13.459V123.313H39.1478V134.62H0Z"
        fill={COLORS.text}
      />
      <Path
        d="M61.2205 74.0383H76.7375L96.8141 134.62H83.9913L79.8008 123.013H58.0747L53.9706 134.62H41.1478L61.2244 74.0383H61.2205ZM76.0384 111.409L68.981 89.9915L61.7507 111.409H76.0384Z"
        fill={COLORS.text}
      />
      <Path
        d="M147.321 119.093C147.321 121.709 146.798 123.986 145.75 125.917C144.701 127.851 143.272 129.459 141.453 130.74C139.635 132.02 137.514 132.989 135.091 133.639C132.668 134.293 130.103 134.62 127.405 134.62H98.8141V74.0386H131.45C133.489 74.0386 135.335 74.4956 136.988 75.4018C138.641 76.312 140.043 77.494 141.202 78.9439C142.361 80.3938 143.252 82.0447 143.888 83.8926C144.521 85.7405 144.839 87.6356 144.839 89.5662C144.839 92.4661 144.136 95.1965 142.73 97.7575C141.324 100.319 139.219 102.253 136.407 103.561C139.765 104.586 142.423 106.406 144.379 109.022C146.335 111.638 147.313 114.995 147.313 119.089L147.321 119.093ZM112.371 85.9847V98.5258H125.673C127.162 98.5258 128.481 98.0136 129.64 96.9892C130.798 95.9648 131.376 94.3731 131.376 92.21C131.376 90.2203 130.865 88.6837 129.848 87.6041C128.827 86.5245 127.602 85.9847 126.172 85.9847H112.371ZM133.524 116.276C133.524 114.4 133.002 112.808 131.953 111.496C130.904 110.188 129.585 109.534 127.986 109.534H112.371V122.761H127.409C129.173 122.761 130.633 122.162 131.788 120.968C132.947 119.774 133.524 118.21 133.524 116.276Z"
        fill={COLORS.text}
      />
      <Path
        d="M194.599 91.9986L183.336 92.038C181.238 81.6088 159.862 82.2983 163.581 92.9915C166.389 101.069 192.105 94.6306 195.907 111.707C202.132 139.661 152.973 141.761 149.706 119.52C149.541 118.405 149.321 116.135 149.321 116.135L161.095 114.697C161.095 114.697 161.759 118.511 164.092 120.745C169.437 125.855 182.817 125.473 183.724 116.911C183.438 105.982 157.521 113.243 151.936 98.5942C141.242 70.5334 193.692 64.7061 194.595 92.0065L194.599 91.9986Z"
        fill={COLORS.text}
      />
      <Path
        d="M209.586 118.375H207.509C203.611 118.375 200.451 121.545 200.451 125.456V127.54C200.451 131.45 203.611 134.62 207.509 134.62H209.586C213.484 134.62 216.644 131.45 216.644 127.54V125.456C216.644 121.545 213.484 118.375 209.586 118.375Z"
        fill={COLORS.text}
      />
    </Svg>
  )
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
  const allTerms = (content.payment_terms ?? []) as PaymentTerm[]
  // Skip empty / placeholder terms — when the template had a payment_term
  // row with label='' and description=undefined, rendering "—" looks
  // unprofessional. Treat as "owner forgot to fill" and hide gracefully.
  const terms = allTerms.filter((t) => {
    if ((t as { visible?: boolean }).visible === false) return false
    const hasLabel = typeof t.label === 'string' && t.label.trim().length > 0
    const hasDesc = typeof t.description === 'string' && t.description.trim().length > 0
    return hasLabel || hasDesc
  })
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
                {term.label?.trim() && (
                  <Text style={styles.termLabel}>{term.label}</Text>
                )}
                {term.description?.trim() && (
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
        {/* Top: brand logo + proposal number. Logo is SVG (paths from
            components/brand/Logo.tsx) so it renders crisp at any zoom.
            Replaces the v0.10.82-83 Helvetica-Bold text fallback. */}
        <View style={styles.header} fixed>
          <BnnyLogo width={70} height={43} />
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
