import { cookies, headers } from 'next/headers'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Admin layout — server component.
 *
 * Two cases render WITHOUT sidebar chrome:
 *  1. /admin/preview      — popup window for client briefing preview
 *  2. Not authenticated   — login screen rendered by the page itself
 *
 * Otherwise we wrap the page in <AdminShell /> which renders the sidebar
 * + the dynamic profile pill in its footer.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const headerList = await headers()

  // Path detection: Next.js doesn't expose the request URL to server layouts
  // directly, so we use a header set by middleware (and fall back to "").
  // We also accept the value from `x-pathname` for clarity.
  const pathname =
    headerList.get('x-pathname') ||
    headerList.get('next-url') ||
    ''
  const isPreview = pathname.startsWith('/admin/preview')

  const auth = cookieStore.get('bnny_auth')
  const isAuthed =
    !!auth && auth.value === (process.env.ADMIN_PASSWORD || 'bnny2024')

  if (isPreview || !isAuthed) {
    return <>{children}</>
  }

  return <AdminShell>{children}</AdminShell>
}
