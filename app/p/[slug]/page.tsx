import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Mail, Phone } from 'lucide-react'
import { getProposalBySlug, listBlocks } from '@/lib/proposals'
import { formatProposalNumber } from '@/lib/proposal-types'
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
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const proposal = await getProposalBySlug(slug)
  if (!proposal) return { title: 'Proposta' }
  const studio = await getStudioIdentity()
  const num = formatProposalNumber(proposal.number, proposal.version_suffix)
  return {
    title: `${num} · ${proposal.title} · ${studio.studio_name}`,
    description: `Orçamento ${num} preparado pela ${studio.studio_name}.`,
    robots: { index: false, follow: false }, // private commercial doc
  }
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { slug } = await params
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

  const num = formatProposalNumber(proposal.number, proposal.version_suffix)
  const validUntil = proposal.valid_until
    ? new Date(proposal.valid_until + 'T00:00:00').toLocaleDateString('pt-BR', {
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
        {/* Header: logo + proposal number */}
        <header className="mb-12 flex items-start justify-between gap-4">
          <Logo className="h-12 w-auto sm:h-14" />
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Orçamento
            </div>
            <div className="font-mono text-sm tabular-nums text-foreground">{num}</div>
          </div>
        </header>

        {/* Document title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {proposal.title}
          </h1>
        </div>

        {/* Body blocks */}
        <div className="space-y-12">
          {visibleBlocks.map((block) => (
            <section key={block.id}>
              <BlockReadOnly block={block} />
            </section>
          ))}
        </div>

        {/* Decision bar — buttons render only if status is 'sent' or 'viewed' */}
        <DecisionBar slug={slug} status={proposal.status} />

        {/* Footer — pulls everything from studio_identity (singleton row) */}
        <footer className="mt-16 border-t border-border pt-8 text-xs leading-relaxed text-muted-foreground">
          <p className="font-mono">
            Obrigado por considerar a {studio.studio_name}!
            {validUntil && ` Esta estimativa é válida até ${validUntil}`}
            {validUntil && ' e pode variar com mudanças no escopo.'}
            {!validUntil && ' Para dúvidas, entre em contato conosco.'}
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
