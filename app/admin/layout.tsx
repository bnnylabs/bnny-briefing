'use client'
import { Sidebar, SidebarLayout } from '@/components/ui/sidebar'
import { usePathname, useRouter } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const NAV_ITEMS = [
    { href: '/admin',          label: 'Briefings', icon: '📋' },
    { href: '/admin/clientes', label: 'Clientes',  icon: '👥' },
    { href: '/admin#log',      label: 'Log',       icon: '📊' },
    { href: '/admin#config',   label: 'Config',    icon: '⚙️' },
  ]

  return (
    <>
      <Sidebar items={NAV_ITEMS} actions={
        <a href="/admin/novo"
          className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all duration-150">
          + Novo briefing
        </a>
      } />
      <SidebarLayout>
        {children}
      </SidebarLayout>
    </>
  )
}
