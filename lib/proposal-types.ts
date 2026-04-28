/**
 * Proposal types — Phase 1 of v0.10.
 *
 * Mirrors the schema defined in supabase/schema-v8.sql. Keep this file in sync
 * whenever the schema changes — it's the source of truth for TS code.
 *
 * Design notes:
 *   - `number` is an integer (1, 2, 3…). `formatProposalNumber()` produces
 *     the user-facing "#001" representation.
 *   - `version_suffix` is null for first version; "A","B","C" for revisions
 *     made after approval (per spec: post-approval edits forbidden, must
 *     create new version).
 *   - `payment_terms` is intentionally a flexible JSONB list. Phase 1 only
 *     ships the "text" type; "pix" / "stripe" / "boleto" come later without
 *     migration.
 */

export type ProposalLanguage = 'pt-BR' | 'en-US'

export type ProposalStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revised'

export type ProposalBlockType =
  | 'header'
  | 'phases'
  | 'investment'
  | 'terms'
  | 'next_steps'
  | 'attachments'
  | 'custom'

export type ProposalActivityActor = 'system' | 'admin' | 'client'

/** Pluggable payment option. v0.10 ships `text`; future: `pix`, `stripe`, `boleto`. */
export type PaymentTerm =
  | {
      type: 'text'
      label: string
      description: string
      discount_percent?: number
    }
  | {
      type: 'pix'
      label: string
      description?: string
      qr_code_url?: string
      pix_key?: string
    }
  | {
      type: 'stripe'
      label: string
      description?: string
      payment_link_url: string
    }
  | {
      type: 'boleto'
      label: string
      description?: string
      boleto_url?: string
    }

/** Approval audit trail captured when client clicks "Aprovar". */
export interface ApprovalData {
  name: string
  email: string
  ip?: string
  user_agent?: string
  timestamp: string
}

/** Phase entry inside a `phases` block (escopo + cronograma unificados). */
export interface ProposalPhase {
  number: string // "1.0", "2.0"… (free-form so user can do "1.1" if needed)
  title: string
  duration: string // "3 a 4 dias úteis", "1 semana", etc.
  description: string
}

/** Block content shape varies by type. Each variant is an explicit interface. */
export interface BlockContentHeader {
  body: string
}
export interface BlockContentPhases {
  phases: ProposalPhase[]
}
export interface BlockContentInvestment {
  intro?: string
  total_amount: number
  currency: string
  payment_terms: PaymentTerm[]
}
export interface BlockContentTerms {
  body_markdown: string
}
export interface BlockContentNextSteps {
  items: string[]
}
export interface BlockContentAttachment {
  name: string
  url: string
}
export interface BlockContentAttachments {
  files: BlockContentAttachment[]
}
export interface BlockContentCustom {
  title: string
  body_markdown: string
}

export type ProposalBlockContent =
  | BlockContentHeader
  | BlockContentPhases
  | BlockContentInvestment
  | BlockContentTerms
  | BlockContentNextSteps
  | BlockContentAttachments
  | BlockContentCustom
  | Record<string, unknown> // permissive fallback while editor evolves

export interface ProposalBlock {
  id: string
  proposal_id: string
  type: ProposalBlockType
  position: number
  content: ProposalBlockContent
  visible: boolean
  created_at: string
}

export interface ProposalItem {
  id: string
  proposal_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
  position: number
  created_at: string
}

export interface Proposal {
  id: string
  slug: string
  number: number
  version_suffix: string | null
  client_id: string
  briefing_id: string | null
  template_id: string | null
  title: string
  language: ProposalLanguage
  status: ProposalStatus
  valid_until: string | null
  sent_at: string | null
  viewed_at: string | null
  approved_at: string | null
  rejected_at: string | null
  approval_data: ApprovalData | null
  rejection_reason: string | null
  total_amount: number
  currency: string
  payment_terms: PaymentTerm[]
  public_settings: Record<string, unknown>
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface ProposalTemplate {
  id: string
  name: string
  description: string | null
  type: string | null
  default_blocks: Array<{
    type: ProposalBlockType
    content: ProposalBlockContent
    position: number
    visible: boolean
  }>
  default_payment_terms: PaymentTerm[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ProposalActivity {
  id: string
  proposal_id: string
  event: string
  actor_type: ProposalActivityActor
  details: Record<string, unknown>
  created_at: string
}

/** Proposal joined with the client row — what the list page receives. */
export interface ProposalWithClient extends Proposal {
  clients: {
    id: string
    name: string
    company: string
    email: string | null
    avatar_url: string | null
  } | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format the proposal number for display.
 *   formatProposalNumber(1)            → "#001"
 *   formatProposalNumber(42)           → "#042"
 *   formatProposalNumber(1, "A")       → "#001-A"
 *   formatProposalNumber(123, null)    → "#123"
 */
export function formatProposalNumber(
  n: number,
  versionSuffix: string | null = null,
): string {
  const padded = String(n).padStart(3, '0')
  return versionSuffix ? `#${padded}-${versionSuffix}` : `#${padded}`
}

/** Generate a URL slug from the proposal title or client company. */
export function generateProposalSlug(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base || 'proposta'}-${suffix}`
}

/** UI-facing label for status. PT-BR only for now; EN added when needed. */
export const PROPOSAL_STATUS_LABELS_PT: Record<ProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  viewed: 'Visualizada',
  approved: 'Aprovada',
  rejected: 'Recusada',
  expired: 'Expirada',
  revised: 'Revisada',
}

/**
 * Map proposal status to the existing 4-color status system used across
 * the app. Reuses muted/info/warning/success so we stay consistent with
 * briefings — no new color tokens.
 */
export function proposalStatusVariant(
  status: ProposalStatus,
): 'muted' | 'info' | 'warning' | 'success' | 'destructive' {
  switch (status) {
    case 'draft':
      return 'muted'
    case 'sent':
      return 'muted'
    case 'viewed':
      return 'info'
    case 'approved':
      return 'success'
    case 'revised':
      return 'warning'
    case 'expired':
      return 'warning'
    case 'rejected':
      return 'destructive'
  }
}
