import { NextResponse } from 'next/server'
import { getBrand } from '@/lib/brand'

/**
 * GET /api/brand
 * Public read-only endpoint exposing the brand identity used by the UI
 * (logo URL, display name). Does NOT include sensitive settings.
 */
export async function GET() {
  const brand = await getBrand()
  return NextResponse.json({
    name: brand.name,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
  })
}
