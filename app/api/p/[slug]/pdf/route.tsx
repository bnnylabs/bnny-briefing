import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getProposalBySlug, listBlocks } from '@/lib/proposals'
import { getStudioIdentity } from '@/lib/studio-identity'
import { formatProposalNumber } from '@/lib/proposal-types'
import type { ProposalScalars } from '@/lib/proposal-types'
import { readTranslatedContent } from '@/lib/translate'
import { ProposalPdfDocument, registerFonts, type ProposalPdfData } from '@/lib/proposal-pdf'

/**
 * GET /api/p/[slug]/pdf
 *
 * Public PDF download for a proposal. Slug is the capability token —
 * same trust model as /p/[slug]. No auth header required.
 *
 * Behavior:
 *   - 404 when slug is unknown
 *   - 404 when proposal is still 'draft' (mirrors the public page —
 *     drafts are not yet public artifacts)
 *   - Reads ?l=pt|en for language; falls back to proposal.language;
 *     defaults to pt-BR
 *   - Streams the PDF as application/pdf with Content-Disposition
 *     attachment so browsers actually download instead of inline-render
 *
 * Caching: deliberately no-store. PDFs are generated on demand and
 * proposals can mutate (price, blocks, etc.) until the moment the
 * client downloads. Cheap enough to render every time (~200ms typical).
 *
 * Performance note: renderToBuffer is sync-ish — it loads the doc
 * into a single Buffer in memory before responding. For typical
 * proposals (~5-15 blocks, no images) this is fine. If we ever ship
 * proposals with embedded photos, switch to renderToStream + a
 * streaming Response.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Parallel fetch — same pattern as the public page.
  const proposal = await getProposalBySlug(slug)
  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Drafts aren't public. Don't leak unsent work.
  if (proposal.status === 'draft') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Resolve target language. Owner-side override via ?l= takes priority
  // because the same proposal can be rendered in either language for
  // different recipients. ?l=en or ?l=en-US both map to en-US.
  const lq = req.nextUrl.searchParams.get('l')
  const lang: 'pt-BR' | 'en-US' =
    lq === 'en' || lq === 'en-US'
      ? 'en-US'
      : lq === 'pt' || lq === 'pt-BR'
        ? 'pt-BR'
        : (proposal.language === 'en-US' ? 'en-US' : 'pt-BR')

  const [blocks, studio] = await Promise.all([
    listBlocks(proposal.id),
    getStudioIdentity(),
  ])

  // Format valid_until in target locale once. PDF receives the string
  // ready to print — keeps the renderer focused on layout.
  let validUntilStr: string | null = null
  if (proposal.valid_until) {
    try {
      validUntilStr = new Date(
        proposal.valid_until + 'T00:00:00',
      ).toLocaleDateString(lang, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      validUntilStr = proposal.valid_until
    }
  }

  const proposalNumber = formatProposalNumber(
    proposal.number,
    proposal.version_suffix,
  )

  // ─── Apply per-language translations (Phase G — schema-v16) ─────────
  // Mirrors the public page logic: scalars and each block read their
  // translation when displayLang !== sourceLang and a translation exists,
  // falling back to source content silently otherwise.
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
  const displayBlocks = blocks.map((block) => {
    const displayContent = readTranslatedContent(
      block.content,
      sourceLang,
      block.translations,
      block.translations_meta,
      lang,
    ).content
    return { ...block, content: displayContent }
  })

  const data: ProposalPdfData = {
    title: displayScalars.title,
    proposalNumber,
    studio,
    blocks: displayBlocks,
    validUntil: validUntilStr,
    lang,
  }

  // Register Geist Mono before rendering. Idempotent — fontsRegistered
  // flag inside the module short-circuits subsequent calls. Origin is
  // resolved from the request because the .woff2 files live in
  // /public/fonts/ and Font.register needs an absolute URL to fetch
  // them. NextRequest.nextUrl gives us protocol+host correctly even
  // behind Vercel's edge proxy.
  registerFonts(req.nextUrl.origin)

  // Render. This produces a Node Buffer; we wrap into a fresh ArrayBuffer
  // copy so NextResponse can serialize it cleanly across runtimes.
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(<ProposalPdfDocument data={data} />)
  } catch (e) {
    console.error('[pdf/render] failed:', e)
    return NextResponse.json(
      { error: 'PDF render failed' },
      { status: 500 },
    )
  }

  // Filename: proposal_number-title-slug.pdf
  // Slug is included so duplicate numbers (shouldn't happen, but
  // defensive) don't collide for the user. We strip /\W/ from title.
  // Title comes from the displayed (translated) version so an EN download
  // gets an EN filename — matches what the recipient sees inside.
  const safeTitle = displayScalars.title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)
  const filename = `${proposalNumber.replace('#', '')}-${safeTitle}.pdf`

  // Convert Node Buffer → Uint8Array for fetch-spec body. NextResponse
  // accepts both but Uint8Array is the more portable choice.
  const body = new Uint8Array(pdfBuffer)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(body.byteLength),
      // Don't cache — proposal content can change at any time.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
