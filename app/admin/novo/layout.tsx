import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Novo briefing',
}

export default function NovoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
