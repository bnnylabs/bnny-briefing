/**
 * Loading skeleton for any /admin/* route during navigation.
 *
 * Next.js streams this immediately when the user clicks an admin link,
 * before the destination page's data fetch resolves. Without it, the
 * admin shell stays frozen on the previous page until the new page is
 * ready — feels broken on slow networks.
 *
 * Mirrors the structural pattern shared by /admin/briefings, /admin/
 * propostas, and /admin/clientes: header bar + metric cards + list rows.
 * Looks 'right' regardless of which admin page the user is heading to.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Metric cards row — sized to match the densest admin pages */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>

      {/* Search + sort row */}
      <div className="mb-3 flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
      </div>

      {/* List rows */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
              </div>
              <div className="h-5 w-20 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
