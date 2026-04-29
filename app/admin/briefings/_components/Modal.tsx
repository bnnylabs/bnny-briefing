'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'

/**
 * Compatibility wrapper around Radix Dialog used by the briefing list
 * page across 7 different modals (responses, diff, edit, notes, etc.).
 *
 * API kept stable so existing callsites — `<Modal onClose={...} wide>...
 * </Modal>` — keep working unchanged. Internally Radix gives us:
 *   - focus-trap (the previous custom impl missed this entirely)
 *   - portal rendering
 *   - aria attributes
 *   - keyboard handling (Esc to close)
 *   - body scroll-lock
 *
 * `onOpenChange(false)` fires for both Esc and overlay click — we
 * forward both to onClose, which is exactly what the old API expected.
 *
 * Extracted from app/admin/briefings/page.tsx (v0.10.101). If the
 * client detail page or other pages start using the same Modal pattern,
 * promote to components/admin/briefings/Modal.tsx (already shared
 * neighborhood there).
 */
export function Modal({
  onClose,
  children,
  wide,
}: {
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent wide={wide} className="max-h-[88vh] overflow-y-auto p-6">
        {children}
      </DialogContent>
    </Dialog>
  )
}
