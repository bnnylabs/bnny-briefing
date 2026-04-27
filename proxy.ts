import { NextResponse, type NextRequest } from 'next/server'

/**
 * Tiny proxy: pass the request pathname through as a header so server
 * components (notably app/admin/layout.tsx) can decide whether to render
 * standalone (preview / login) or with the admin shell.
 *
 * Does NOT enforce auth — that lives in the layout and individual routes.
 *
 * Renamed from middleware.ts to proxy.ts in Next.js 16. Same behavior,
 * runs at the Node.js runtime (proxy doesn't support edge — that's only
 * available in the legacy middleware convention).
 */
export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  // Skip Next internals and static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
