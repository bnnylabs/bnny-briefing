import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Global security headers middleware.
 *
 * Runs on every request (except for /_next assets, see config.matcher
 * below) and adds defensive HTTP headers. These don't change the app
 * behavior — they tell browsers to enforce stricter rules on top of
 * whatever HTML/JS we serve.
 *
 * NOT included in this iteration:
 *   - Content-Security-Policy: requires per-request nonces to coexist
 *     with Next.js inline scripts and Radix style injection. Adding it
 *     wrong silently breaks the admin shell. We chose Option C in the
 *     v0.10.68 plan — ship the rest, defer CSP to a focused session.
 *
 * The matcher below skips static assets and API routes that already
 * set their own headers. The headers below are aimed at HTML responses,
 * which is where the protections actually matter.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // HSTS: tell the browser to refuse HTTP for the next year. Vercel
  // already redirects http→https, but HSTS prevents the redirect from
  // being attacked (an attacker on the network sniffs the first http
  // request before the redirect lands). includeSubDomains protects
  // *.bnnylabs.com if/when subdomains are added.
  // 31536000 = 365 days in seconds.
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  )

  // Anti-clickjacking. SAMEORIGIN allows our own pages to embed each
  // other (e.g. admin preview iframes) but blocks foreign sites from
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
  // third-party scripts (we don't have any today, this is defense
  // in depth).
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  )

  return res
}

export const config = {
  /**
   * Apply to all paths EXCEPT:
   *   - /_next/static (compiled JS/CSS — already immutable, no need)
   *   - /_next/image  (image optimizer)
   *   - /favicon.ico, /robots.txt, /sitemap.xml (static metadata)
   *
   * API routes ARE included so the headers go on JSON responses too —
   * cheap, no downside, and protects API responses that get embedded
   * in error pages or developer tools.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
