import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 proxy (formerly known as middleware in Next 15 and earlier).
 *
 * Two responsibilities, both global:
 *
 *   1. Forward the request pathname as `x-pathname` so server components
 *      — notably app/admin/layout.tsx — can branch on the URL without
 *      reaching for browser-only APIs. This was the original purpose of
 *      this file.
 *
 *   2. Stamp every response with the security headers added in v0.10.68.
 *      These were briefly introduced as a separate middleware.ts file,
 *      but Next 16 rejects having both files coexist (build error:
 *      "use ./proxy.ts only"). Folded back into the proxy here.
 *
 * Headers below are aimed at HTML responses (where browser-side defenses
 * actually matter). They're set on every response that flows through this
 * proxy — that's everything except _next/static, _next/image, favicon, etc.
 *
 * NOT included (intentional, Option C of the v0.10.68 plan):
 *   - Content-Security-Policy. Requires per-request nonces to coexist
 *     with Next.js inline scripts and Radix style injection. Adding it
 *     wrong silently breaks the admin shell. Deferred to a focused
 *     session.
 */
export function proxy(req: NextRequest) {
  // Forward pathname for server components to inspect.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // ── Security headers ────────────────────────────────────────────────

  // HSTS: tell the browser to refuse HTTP for the next year. Vercel
  // already redirects http→https, but HSTS prevents the redirect from
  // being attacked (an attacker on the network sniffs the first http
  // request before the redirect lands). includeSubDomains protects
  // *.bnnylabs.com if/when subdomains are added.
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  )

  // Anti-clickjacking. SAMEORIGIN allows our own pages to embed each
  // other (preview modal, email iframe) but blocks foreign sites from
  // wrapping our admin in an invisible iframe to trick clicks.
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')

  // Stop browsers from "sniffing" content type from response bytes.
  // If we say Content-Type: image/png, the browser must treat it as
  // an image even if the bytes look like HTML. Defends against
  // upload-then-serve XSS via storage buckets.
  res.headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer-Policy: when a user clicks a link out of the app, only
  // the origin (https://briefing.bnnylabs.com) is sent — never the
  // full URL with the slug. Protects briefing/proposal slugs from
  // leaking into third-party analytics on outbound clicks.
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy: explicitly deny APIs we never use. If a
  // dependency tries to access camera/mic/geolocation, the browser
  // blocks it without prompting. Reduces surface for malicious
  // third-party scripts (we don't have any today; defense in depth).
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )

  return res
}

export const config = {
  /**
   * Apply to everything EXCEPT:
   *   - /api/*               (API routes set their own headers; proxy
   *                          here would double-set on JSON responses,
   *                          harmless but noise. Existing matcher
   *                          excluded /api before; preserved here.)
   *   - /_next/static        (compiled JS/CSS — already immutable)
   *   - /_next/image         (image optimizer)
   *   - /favicon.ico         (static metadata)
   *
   * Keeping the same matcher the original proxy used so we don't change
   * which routes get the pathname header — only added the security
   * headers on top.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
