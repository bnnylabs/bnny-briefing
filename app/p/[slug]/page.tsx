import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Mail, Phone } from 'lucide-react'
import { getProposalBySlug, listBlocks, getLatestDecision } from '@/lib/proposals'
import { formatProposalNumber } from '@/lib/proposal-types'
import type { ProposalScalars } from '@/lib/proposal-types'
import { readTranslatedContent } from '@/lib/translate'
import { getStudioIdentity, formatStudioLocation } from '@/lib/studio-identity'
import { ProposalMarkdown } from '@/lib/proposal-markdown'
import { Logo } from '@/components/brand/Logo'
import { BlockReadOnly } from '@/components/admin/proposals/BlockReadOnly'
import { ProposalViewTracker } from './ProposalViewTracker'
import { DecisionBar } from './DecisionBar'

/**
 * Public proposal view — `/p/[slug]`
 *
 * Read-only surface the client opens via emailed link. SSR for fast first
 * paint and clean OG metadata. View tracking is delegated to a tiny client
 * component so we don't ping the API on every server render (which would
 * happen on hot reload, prefetch, or any kind of revalidation).
 *
 * Status changes:
 *   - First load fires POST /api/p/[slug]/view → sets viewed_at + status='viewed'
 *     (only if status is currently 'draft' or 'sent', never downgrades)
 *
 * Layout:
 *   - Mint Teal top bar (brand strip)
 *   - Logo + proposal number
 *   - Title (block: header)
 *   - Body blocks in order
 *   - Footer with validity + studio contact
 *
 * Visual reference: bnny_labs_orcamento_horus_connect (PDF model migrated
 * from the old system). We don't try for pixel parity — just the same vibe:
 * clean, monospaced numbers, mint accents, generous whitespace.
 */

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ l?: string }>
}

/**
 * Resolve the page language. The `?l=` query param wins (set by the
 * /send route based on each recipient's contact.language). Default
 * is pt-BR — kept simple, no Accept-Language sniffing.
 */
type PageLang = 'pt-BR' | 'en-US'
function resolveLang(l?: string): PageLang {
  return l === 'en' || l === 'en-US' ? 'en-US' : 'pt-BR'
}

/**
 * Tiny i18n table for the public page. Keep this colocated with the
 * usage — there's no plan to externalize unless we add Spanish or
 * something. The DecisionBar has its own copy of strings (it's a
 * client component, easier to keep its own dict than thread props).
 */
function t(lang: PageLang) {
  if (lang === 'en-US') {
    return {
      validUntilLocale: 'en-US' as const,
      proposalLabel: 'PROPOSAL',
      downloadPdf: 'Download PDF',
      thanksFor: (studioName: string) => `Thank you for considering ${studioName}!`,
      validUntilText: (date: string) => ` This estimate is valid through ${date}`,
      andMayChange: ' and may change with scope adjustments.',
      contactUs: ' For questions, get in touch.',
    }
  }
  return {
    validUntilLocale: 'pt-BR' as const,
    proposalLabel: 'ORÇAMENTO',
    downloadPdf: 'Baixar PDF',
    thanksFor: (studioName: string) => `Obrigado por considerar a ${studioName}!`,
    validUntilText: (date: string) => ` Esta estimativa é válida até ${date}`,
    andMayChange: ' e pode variar com mudanças no escopo.',
    contactUs: ' Para dúvidas, entre em contato conosco.',
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  const lang = resolveLang(sp.l)
  const proposal = await getProposalBySlug(slug)
  if (!proposal) return { title: 'Proposta' }
  const studio = await getStudioIdentity()
  const num = formatProposalNumber(proposal.number, proposal.version_suffix)

  // Use translated title in the browser tab when available; falls back
  // to source silently when no translation exists for this lang.
  const sourceScalars: ProposalScalars = {
    title: proposal.title,
    payment_terms: proposal.payment_terms,
  }
  const displayTitle = readTranslatedContent(
    sourceScalars,
    proposal.language,
    proposal.translations,
    proposal.translations_meta,
    lang,
  ).content.title

  return {
    title: `${num} · ${displayTitle} · ${studio.studio_name}`,
    description: `Orçamento ${num} preparado pela ${studio.studio_name}.`,
    robots: { index: false, follow: false }, // private commercial doc
  }
}

export default async function PublicProposalPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const lang = resolveLang(sp.l)
  const proposal = await getProposalBySlug(slug)
  if (!proposal) notFound()

  // Drafts aren't supposed to be visible publicly — once published, status
  // moves to 'sent' before any link goes out. If someone hits the URL
  // before that, behave like the proposal doesn't exist (404) so the
  // sharable URL doesn't leak draft state.
  if (proposal.status === 'draft') notFound()

  const [blocks, studio] = await Promise.all([
    listBlocks(proposal.id),
    getStudioIdentity(),
  ])
  const visibleBlocks = blocks.filter((b) => b.visible !== false)

  // ─── Apply per-language translations (Phase G — schema-v16) ─────────
  // The `?l=en` query param only flipped the page chrome before — block
  // content stayed in the source language. Now each block + the proposal
  // scalars (title, payment_terms) read their translation when:
  //   - displayLang !== sourceLang, AND
  //   - a translation exists for displayLang.
  // When the translation is missing, readTranslatedContent falls back to
  // the source content silently — better than rendering nothing or a
  // jarring "untranslated" placeholder.
  const sourceLang = proposal.language
  const sourceScalars: ProposalScalars = {
    title: proposal.title,
    payment_terms: proposal.payment_terms,
  }
  const displayScalars = readTranslatedContent(
    sourceScalars,
    sourceLang,
    proposal.translations,
    proposal.translations_meta,
    lang,
  ).content

  const displayBlocks = visibleBlocks.map((block) => {
    const displayContent = readTranslatedContent(
      block.content,
      sourceLang,
      block.translations,
      block.translations_meta,
      lang,
    ).content
    return { ...block, content: displayContent }
  })

  // Pull the actor info for already-decided proposals so every contact
  // (not just the one who clicked) sees who decided. Skip the query
  // for non-terminal statuses — saves a round-trip on the hot path.
  const latestDecision =
    proposal.status === 'approved' || proposal.status === 'rejected'
      ? await getLatestDecision(proposal.id)
      : null

  const num = formatProposalNumber(proposal.number, proposal.version_suffix)
  const i18n = t(lang)
  const validUntil = proposal.valid_until
    ? new Date(proposal.valid_until + 'T00:00:00').toLocaleDateString(i18n.validUntilLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProposalViewTracker slug={slug} status={proposal.status} />

      {/* Mint top strip — visual signature */}
      <div className="h-1.5 w-full bg-primary" />

      <article className="mx-auto max-w-3xl px-6 py-10 sm:py-16 sm:px-10">
        {/* Header: logo + proposal number + PDF download */}
        <header className="mb-12 flex items-start justify-between gap-4">
          <Logo className="h-12 w-auto sm:h-14" />
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {i18n.proposalLabel}
            </div>
            <div className="font-mono text-sm tabular-nums text-foreground">{num}</div>
            {/* PDF download — discrete link below the number. Carries the
                same ?l=<lang> the page is using so the PDF matches the
                public render. Server-rendered <a> for max compatibility:
                no JS, browser handles the download via Content-Disposition. */}
            <a
              href={`/api/p/${slug}/pdf?l=${lang === 'en-US' ? 'en' : 'pt'}`}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              ↓ {i18n.downloadPdf}
            </a>
          </div>
        </header>

        {/* Document title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {displayScalars.title}
          </h1>
        </div>

        {/* Body blocks */}
        <div className="space-y-12">
          {displayBlocks.map((block) => (
            <section key={block.id}>
              <BlockReadOnly block={block} />
            </section>
          ))}
        </div>

        {/* Decision bar — buttons render only if status is 'sent' or 'viewed' */}
        <DecisionBar
          slug={slug}
          status={proposal.status}
          lang={lang}
          decision={latestDecision}
        />

        {/* Footer — pulls everything from studio_identity (singleton row) */}
        <footer className="mt-16 border-t border-border pt-8 text-xs leading-relaxed text-muted-foreground">
          <p className="font-mono">
            {i18n.thanksFor(studio.studio_name)}
            {validUntil && i18n.validUntilText(validUntil)}
            {validUntil && i18n.andMayChange}
            {!validUntil && i18n.contactUs}
          </p>

          {/* Owner-editable disclaimer (markdown). Rendered via the same
              ProposalMarkdown component used in proposal blocks for
              consistent typography and safe HTML escaping. */}
          {studio.footer_disclaimer && (
            <div className="mt-3 max-w-prose font-mono text-[11px] opacity-80">
              <ProposalMarkdown source={studio.footer_disclaimer} />
            </div>
          )}

          {/* Contact pills — only render the ones that have data */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {studio.phone_contact && (
              <a
                href={
                  studio.whatsapp_contact
                    ? `https://wa.me/${studio.whatsapp_contact}`
                    : `tel:${studio.phone_contact.replace(/\s+/g, '')}`
                }
                className="inline-flex items-center gap-2 rounded bg-primary/15 px-2 py-1 font-mono text-foreground transition-colors hover:bg-primary/25"
              >
                <Phone className="h-3 w-3" />
                {studio.phone_contact}
              </a>
            )}
            <a
              href={`mailto:${studio.email_contact}`}
              className="inline-flex items-center gap-2 rounded bg-primary/15 px-2 py-1 font-mono text-foreground transition-colors hover:bg-primary/25"
            >
              <Mail className="h-3 w-3" />
              {studio.email_contact}
            </a>
          </div>

          {/* Optional location line */}
          {formatStudioLocation(studio) && (
            <p className="mt-3 font-mono text-[11px] opacity-70">
              {studio.studio_name} · {formatStudioLocation(studio)}
              {studio.cnpj && ` · CNPJ ${studio.cnpj}`}
            </p>
          )}
        </footer>
      </article>
    </div>
  )
}
