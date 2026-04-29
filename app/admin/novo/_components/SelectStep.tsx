'use client'

import { useState } from 'react'
import { Bot, ChevronRight, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

/**
 * Step 1 of the new-briefing wizard. Operator either picks an
 * existing client (filters by company/name/email substring) or
 * starts a new client form.
 *
 * Search state is local to this step — the parent doesn't need to
 * track it because the filter is purely view-side. Filtering also
 * happens here for the same reason. When the operator picks a client,
 * `onSelect(client)` fires and the parent advances to step 'type'
 * with the picked client pre-loaded.
 *
 * Pulled out of app/admin/novo/page.tsx in v0.10.105.
 */

export interface ExistingClient {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website: string | null
  analysis: Record<string, unknown> | null
}

export function SelectStep({
  clients,
  loading,
  onSelect,
  onNewClient,
}: {
  clients: ExistingClient[]
  loading: boolean
  onSelect: (c: ExistingClient) => void
  /** Operator chose to start a fresh client. Parent flips to 'client' step. */
  onNewClient: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = clients.filter(
    (c) =>
      !search ||
      [c.company, c.name, c.email].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  )

  return (
    <div>
      <h2 className="mb-1.5 font-mono text-2xl font-bold tracking-tight">
        Para qual cliente?
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Selecione um cliente existente ou crie um novo.
      </p>

      {/* Search existing */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa ou nome..."
          autoFocus
          className="pl-9"
        />
      </div>

      {/* Client list */}
      {loading ? (
        <div className="mb-4 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="mb-2 h-3.5 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="mb-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  <span className="truncate">{c.company}</span>
                  {c.analysis && Object.keys(c.analysis).length > 0 && (
                    <Bot
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="Perfil IA disponível"
                    />
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.name}
                  {c.email && ` · ${c.email}`}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : search ? (
        <div className="mb-4 py-5 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado para &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="mb-4 py-5 text-center text-sm text-muted-foreground">
          Nenhum cliente cadastrado ainda
        </div>
      )}

      {/* Divider */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" onClick={onNewClient}>
        <Plus className="mr-1.5 h-4 w-4" />
        Criar novo cliente
      </Button>
    </div>
  )
}
