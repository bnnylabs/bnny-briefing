/**
 * Social network icons for the client detail page.
 * Uses @icons-pack/react-simple-icons for all networks except LinkedIn
 * (not in this package version — inline SVG path used instead).
 */

import { SiFacebook, SiInstagram, SiPinterest, SiTiktok, SiX, SiYoutube } from '@icons-pack/react-simple-icons'
import { Globe } from 'lucide-react'

interface IconProps { size?: number; className?: string }

function LinkedInIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export type SocialKey = 'instagram' | 'linkedin' | 'facebook' | 'youtube' | 'tiktok' | 'twitter' | 'pinterest' | 'other'

export const SOCIAL_NETWORKS: Array<{
  key: SocialKey
  label: string
  Icon: React.ComponentType<IconProps>
}> = [
  { key: 'instagram', label: 'Instagram', Icon: ({ size, className }) => <SiInstagram size={size} className={className} /> },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon },
  { key: 'facebook', label: 'Facebook', Icon: ({ size, className }) => <SiFacebook size={size} className={className} /> },
  { key: 'youtube', label: 'YouTube', Icon: ({ size, className }) => <SiYoutube size={size} className={className} /> },
  { key: 'tiktok', label: 'TikTok', Icon: ({ size, className }) => <SiTiktok size={size} className={className} /> },
  { key: 'twitter', label: 'X / Twitter', Icon: ({ size, className }) => <SiX size={size} className={className} /> },
  { key: 'pinterest', label: 'Pinterest', Icon: ({ size, className }) => <SiPinterest size={size} className={className} /> },
  { key: 'other', label: 'Outro', Icon: Globe },
]
