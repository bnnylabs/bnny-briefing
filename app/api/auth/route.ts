import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, mintSessionToken } from '@/lib/auth'

/**
 * POST /api/auth — exchange a password for a signed session cookie.
 *
 * The cookie no longer carries the password. It carries a token of the
 * form `{millis}.{hmac(millis, AUTH_SECRET)}` that the verify side
 * recomputes. See lib/auth.ts for the full model.
 */
export async function POST(req: NextRequest) {
  let body: { password?: unknown }
  try {
    body = (await req.json()) as { password?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('bnny_auth', mintSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie maxAge is a hint to the browser; the source of truth for
    // expiration is the timestamp embedded inside the token, validated
    // server-side by verifySessionToken. Keep them aligned (7 days).
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}

/** DELETE /api/auth — sign out by clearing the cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('bnny_auth')
  return response
}
