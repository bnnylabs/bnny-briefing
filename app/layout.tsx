import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bnny Labs — Briefing',
  description: 'Sistema de briefing Bnny Labs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  )
}
