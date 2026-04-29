'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  ListChecks,
} from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useToast, ToastContainer } from '@/components/toast'
import { ModelosTab } from './ModelosTab'
import { EstudioTab } from './EstudioTab'
import { PagamentosTab } from './PagamentosTab'
import { TermosTab } from './TermosTab'
import { ProximosPassosTab } from './ProximosPassosTab'

/**
 * Centro de Configurações de Propostas — Fase 2 do roadmap.
 *
 * 5 abas planejadas:
 *   - Modelos              ✦ ativa
 *   - Pagamentos          ✦ ativa (v0.10.85)
 *   - Termos              ✦ ativa (v0.10.87)
 *   - Próximos passos     ✦ ativa (v0.10.88)
 *   - Estúdio             ✦ ativa (v0.10.74)
 *
 * Esta página é só o lobby — o editor de blocos de cada modelo fica em
 * /admin/config/propostas/modelos/[id] porque é grande demais pra rodar
 * inline numa aba.
 */
export default function ConfigPropostasPage() {
  const router = useRouter()
  const { toasts, toast, remove } = useToast()
  const [activeTab, setActiveTab] = React.useState('modelos')

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-3xl p-6">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: 'Propostas', href: '/admin/propostas' },
            { label: 'Configurações' },
          ]}
        />

        <div className="mb-6 flex items-center gap-2">
          <IconButton
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Voltar"
            size="icon"
            onClick={() => router.push('/admin/propostas')}
          />
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">
              Configurações de Propostas
            </h1>
            <p className="text-xs text-muted-foreground">
              Modelos, condições de pagamento, termos e próximos passos
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex w-full overflow-x-auto sm:grid sm:grid-cols-5">
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="termos">Termos</TabsTrigger>
            <TabsTrigger value="proximos">Próximos passos</TabsTrigger>
            <TabsTrigger value="estudio">Estúdio</TabsTrigger>
          </TabsList>

          <TabsContent value="modelos">
            <ModelosTab toast={toast} />
          </TabsContent>

          <TabsContent value="pagamentos">
            <PagamentosTab toast={toast} />
          </TabsContent>

          <TabsContent value="termos">
            <TermosTab toast={toast} />
          </TabsContent>

          <TabsContent value="proximos">
            <ProximosPassosTab toast={toast} />
          </TabsContent>

          <TabsContent value="estudio">
            <EstudioTab toast={toast} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

interface ComingSoonPanelProps {
  icon: React.ReactNode
  title: string
  description: string
}

function ComingSoonPanel({ icon, title, description }: ComingSoonPanelProps) {
  return (
    <Card className="p-12">
      <div className="mx-auto max-w-md text-center text-muted-foreground">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
          {icon}
        </div>
        <div className="mb-1.5 inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Em breve
          </span>
        </div>
        <div className="mb-2 text-base font-semibold text-foreground">{title}</div>
        <div className="text-sm">{description}</div>
      </div>
    </Card>
  )
}
