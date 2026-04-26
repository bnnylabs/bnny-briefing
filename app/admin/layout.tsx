import { Sidebar, SidebarLayout } from '@/components/ui/sidebar'

const NAV_ITEMS = [
  { href: '/admin',          label: 'Briefings',  icon: '📋' },
  { href: '/admin/clientes', label: 'Clientes',   icon: '👥' },
  { href: '/admin/log',      label: 'Log',        icon: '📊' },
  { href: '/admin/config',   label: 'Config',     icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar
        items={NAV_ITEMS}
        actions={
          <a href="/admin/novo"
            className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors">
            + Novo briefing
          </a>
        }
      />
      <SidebarLayout>
        {children}
      </SidebarLayout>
    </>
  )
}
