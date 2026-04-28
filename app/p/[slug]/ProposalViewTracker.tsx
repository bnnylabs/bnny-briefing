'use client'

import * as React from 'react'

interface ProposalViewTrackerProps {
  slug: string
  status: string
}

/**
 * Fires POST /api/p/[slug]/view once per mount, only when the proposal is
 * in a state where 'viewed' is a meaningful upgrade ('sent'). The endpoint
 * itself is also defensive — this is a belt + suspenders, nothing else.
 *
 * Doesn't block render and silently swallows errors — tracking is best
 * effort, never breaks the page for the client.
 */
export function ProposalViewTracker({ slug, status }: ProposalViewTrackerProps) {
  React.useEffect(() => {
    // Only ping when the upgrade is meaningful. 'approved' / 'rejected' /
    // 'expired' / 'revised' should never be downgraded by a view.
    if (status !== 'sent') return

    // Use keepalive so a quick close still registers the view.
    const ctrl = new AbortController()
    fetch(`/api/p/${slug}/view`, {
      method: 'POST',
      keepalive: true,
      signal: ctrl.signal,
    }).catch(() => {
      // Best-effort tracking — never surface errors to the client.
    })
    return () => ctrl.abort()
  }, [slug, status])

  return null
}
