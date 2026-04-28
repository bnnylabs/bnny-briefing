/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Hardening ────────────────────────────────────────────────────────
  // Strict mode catches subtle bugs (double-invocation of effects in dev
  // surfaces stale closures and missing cleanup paths). Costs nothing
  // at production runtime.
  reactStrictMode: true,

  // The default 'X-Powered-By: Next.js' header leaks the framework
  // version on every response — small but unnecessary surface area.
  poweredByHeader: false,

  // ── Image optimization ──────────────────────────────────────────────
  // Avatars are stored in Supabase Storage. Allowlist that origin so
  // <Image /> can serve optimized variants (AVIF/WebP, responsive
  // sizes, lazy by default) instead of <img> tags going straight to
  // the source.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  // ── Bundle size ──────────────────────────────────────────────────────
  // experimental.optimizePackageImports rewrites named imports from these
  // packages to deep imports at build time. Tree-shaking already works
  // for most of them, but this guarantees it across all client bundles
  // and meaningfully reduces JS sent to the browser for routes that only
  // touch a handful of icons or radix primitives.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@icons-pack/react-simple-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },
}

module.exports = nextConfig
