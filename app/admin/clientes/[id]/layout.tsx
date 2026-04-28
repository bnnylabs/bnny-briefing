import type { Metadata } from 'next'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

/**
 * Per-request cached fetch of just the client's company name. This
 * keeps generateMetadata fast without duplicating the page's full
 * client query. The page itself is 'use client' and fetches the full
 * record over the API, so there is no double-fetch concern here — the
 * metadata fetch is cheap and dedicated.
 *
 * cache() makes it idempotent within the same server request, which
 * matters if Next.js calls generateMetadata more than once.
 */
const getClientCompany = cache(async (id: string): Promise<string | null> => {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('company')
    .eq('id', id)
    .maybeSingle()
  return (data as { company?: string | null } | null)?.company ?? null
})

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params
  const company = await getClientCompany(id)
  return {
    title: company ?? 'Cliente',
  }
}

export default function ClienteLayout({ children }: LayoutProps) {
  return children
}
