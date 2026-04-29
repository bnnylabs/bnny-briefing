/**
 * Email module — barrel export.
 *
 * The actual implementation lives in four focused modules:
 *
 *   • email-render.ts     — visual tokens, settings cache, composeEmail,
 *                           render helpers (button, meta card, diff,
 *                           fallback link, editing window)
 *   • email-briefings.ts  — 4 briefing senders (invitation, completion,
 *                           reminder, client confirmation)
 *   • email-proposals.ts  — 6 proposal senders (sent, viewed, approved
 *                           and rejected — admin and actor variants)
 *   • email-preview.ts    — composePreview for the editor's live preview
 *
 * Plus sendWhatsApp at the bottom of this file — kept here because it's
 * the only non-email outgoing notification and doesn't merit its own
 * file yet. May graduate to lib/whatsapp.ts if other channels are added.
 *
 * Existing call sites that `import { sendX } from '@/lib/email'` keep
 * working unchanged — that's the point of the barrel.
 */

export {
  composeEmail,
  invalidateEmailSettingsCache,
  renderDiffSection,
  renderEditingWindowBlock,
  renderFallbackLinkBlock,
  renderMetaCard,
  type DiffChange,
  type MetaItem,
  type RenderedEmail,
} from './email-render'

// Briefing senders
export {
  sendBriefingToClient,
  sendCompletionToAdmin,
  sendReminderToClient,
  sendClientConfirmation,
} from './email-briefings'

// Proposal senders
export {
  sendProposalToClient,
  sendProposalViewedToAdmin,
  sendProposalApprovedToAdmin,
  sendProposalRejectedToAdmin,
  sendProposalApprovedToActor,
  sendProposalRejectedToActor,
} from './email-proposals'

// Preview
export { composePreview } from './email-preview'

// ─── WhatsApp via CallMeBot ──────────────────────────────────────────────

export async function sendWhatsApp(message: string) {
  const phone = process.env.CALLMEBOT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY

  if (!phone || !apikey) {
    console.warn('WhatsApp env vars not configured (CALLMEBOT_PHONE/APIKEY)')
    return { ok: false, error: 'not_configured' }
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`

  try {
    const response = await fetch(url)
    return { ok: response.ok }
  } catch (error) {
    console.error('sendWhatsApp failed:', error)
    return { ok: false, error }
  }
}
