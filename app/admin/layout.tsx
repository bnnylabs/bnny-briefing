'use client'
import { Sidebar, SidebarLayout } from '@/components/ui/sidebar'
import { FileText, Users, ScrollText, Settings } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const NAV_ITEMS = [
    { href: '/admin',          label: 'Briefings', icon: <FileText size={15} /> },
    { href: '/admin/clientes', label: 'Clientes',  icon: <Users size={15} /> },
    { href: '/admin#log',      label: 'Log',       icon: <ScrollText size={15} /> },
    { href: '/admin#config',   label: 'Config',    icon: <Settings size={15} /> },
  ]

  return (
    <>
      <Sidebar items={NAV_ITEMS} actions={
        <a href="/admin/novo"
          className="flex items-center justify-center gap-1.5 w-full h-8 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors">
          + Novo briefing
        </a>
      } />
      <SidebarLayout>
        {children}
      </SidebarLayout>
    </>
  )
}
