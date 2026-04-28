import type { Metadata } from 'next'

// Server-component layout used solely to set the per-section title.
// The page itself stays 'use client'; this file does not render a
// wrapper, only injects metadata for the segment.

export const metadata: Metadata = {
  title: 'Clientes',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
