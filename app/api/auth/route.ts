import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD || 'bnny2024'

  if (password === adminPassword) {
    const response = NextResponse.json({ ok: true })
    response.cookies.set('bnny_auth', adminPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('bnny_auth')
  return response
}
