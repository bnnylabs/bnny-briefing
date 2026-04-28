import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'

// ── Self-hosted, optimized fonts ────────────────────────────────────────
// next/font handles preload, swap, subsetting and zero-CLS automatically.
// Replaces the previous render-blocking @import "@fontsource-variable/*"
// in globals.css.

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Bnny Labs — Briefing',
    template: '%s · Bnny Labs',
  },
  description: 'Sistema de briefings, propostas e gestão de clientes da Bnny Labs.',
  applicationName: 'Bnny Labs',
  authors: [{ name: 'Bnny Labs' }],
  // Robots is permissive on admin (auth-gated server-side anyway) and
  // restricted on public proposal pages (handled per-route).
  robots: { index: false, follow: false },
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#12fea9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        {/* delayDuration shorter than default (700ms) so icon-only buttons
            give quick feedback without feeling sluggish. */}
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  )
}
