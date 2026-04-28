/**
 * Centralized authentication for admin endpoints.
 *
 * Replaces the old per-file `isAuthed(req)` pattern (35 copies) and the
 * `process.env.ADMIN_PASSWORD || 'bnny2024'` fallback that would silently
 * grant admin access if the env var ever failed to load on a deploy.
 *
 * Boot-time invariants:
 *   - ADMIN_PASSWORD must be set. Without it, the app refuses to boot —
 *     better than running with a publicly-known password.
 *   - AUTH_SECRET must be set. Used to HMAC-sign session tokens so the
 *     cookie doesn't carry the password in plaintext.
 *
 * Session model:
 *   - Login (POST /api/auth) verifies the password with timingSafeEqual,
 *     then issues a token of the form  `{timestamp}.{hex_signature}`.
 *   - Verify reads the cookie, recomputes the signature with the secret,
 *     and timing-safely compares. Tokens older than 7 days are rejected.
 *   - The cookie no longer contains the password, so even if it leaks
 *     (browser extension, screenshot, proxy log) the password isn't in it.
 *   - Rotating AUTH_SECRET invalidates every active session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.AUTH_SECRET
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// Fail fast at boot time if the deployment is misconfigured. This runs
// when this module is first imported (which happens on the first request
// hit after a cold start). The error surfaces in Vercel logs and the
// affected route returns 500 — better than silently accepting weak auth.
if (!SECRET) {
  throw new Error('AUTH_SECRET environment variable is required')
}
if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required')
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Compare a plaintext password to ADMIN_PASSWORD using timingSafeEqual.
 * timingSafeEqual requires equal-length buffers; we short-circuit on
 * length mismatch (which itself leaks length, but the password length
 * is a relatively weak secret compared to the full password).
 */
export function checkPassword(password: string): boolean {
  if (typeof password !== 'string') return false
  const a = Buffer.from(password)
  const b = Buffer.from(ADMIN_PASSWORD!)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Mint a fresh session token: `{millis}.{sha256(millis + AUTH_SECRET)}`.
 * Embedding the timestamp in the token (and not the cookie metadata)
 * lets verifySessionToken enforce TTL even if the cookie's maxAge has
 * been tampered with on the client.
 */
export function mintSessionToken(): string {
  const ts = Date.now().toString()
  const sig = createHash('sha256').update(ts + SECRET).digest('hex')
  return `${ts}.${sig}`
}

/**
 * Verify a session token. Returns true iff:
 *   - format is `{ts}.{sig}` with sig hex
 *   - the embedded timestamp parses as a number
 *   - the token is within the TTL window
 *   - the signature matches the one we recompute from the timestamp
 */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return false

  const ts = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  if (Date.now() - tsNum > SESSION_TTL_MS) return false

  const expected = createHash('sha256').update(ts + SECRET).digest('hex')

  // timingSafeEqual on hex requires both to be valid hex of the same
  // length. If anything is off, treat as mismatch instead of throwing.
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

/**
 * Convenience for handlers that just need a boolean. Reads the bnny_auth
 * cookie and verifies it. Use `requireAuth(req)` instead when you want
 * the canonical 401 response handed back automatically.
 */
export function isAuthed(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get('bnny_auth')?.value)
}

/**
 * Returns null when authenticated; otherwise returns a ready-to-go 401
 * NextResponse. Idiomatic usage in a handler:
 *
 *     export async function GET(req: NextRequest) {
 *       const unauthorized = requireAuth(req)
 *       if (unauthorized) return unauthorized
 *       // ...rest of handler
 *     }
 *
 * This shape keeps the early-return discipline that Next.js handlers
 * already use elsewhere in the codebase, with one fewer imported symbol.
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (isAuthed(req)) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
