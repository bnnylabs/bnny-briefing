'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast, ToastContainer } from '@/components/toast'

interface ClientStats { total: number; concluido: number; last_at: string | null }
interface Client {
  id: string; name: string; company: string; email: string; phone: string
  website: string | null; analysis: Record<string, unknown> | null
  created_at: string; stats: ClientStats
}
type Filter = 'all' | 'with_briefing' | 'no_briefing' | 'with_ai'
type SortKey = 'recent' | 'name' | 'briefings'

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 11, width: '60%' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="skeleton" style={{ width: 36, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 36, height: 32, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

export default function ClientesPage() {
  const router = useRouter()
  const { toasts, toast, remove } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', company: '', email: '', phone: '', website: '' })
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/clients')
    if (res.ok) { const d = await res.json(); setClients(d.clients || []) }
    else if (res.status === 401) router.push('/admin')
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.name || !newForm.company) return
    setSaving(true)
    const res = await fetch('/api/admin/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm)
    })
    if (res.ok) {
      const d = await res.json()
      setShowNew(false)
      setNewForm({ name: '', company: '', email: '', phone: '', website: '' })
      toast(`${newForm.company} criado`, 'success')
      router.push(`/admin/clientes/${d.client.id}`)
    } else { toast('Erro ao criar cliente', 'error') }
    setSaving(false)
  }

  async function deleteClient() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/admin/clients/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) { toast(`${deleteTarget.company} excluído`, 'success'); setDeleteTarget(null); load() }
    else { const d = await res.json(); toast(d.error || 'Erro ao excluir', 'error'); setDeleteTarget(null) }
    setDeleting(false)
  }

  async function batchDelete() {
    const ids = Array.from(selectedIds)
    setBatchDeleting(true)
    const res = await fetch('/api/admin/clients/batch-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
    })
    if (res.ok) { toast(`${ids.length} cliente${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''}`, 'success'); setSelectedIds(new Set()); setBatchDeleteConfirm(false); load() }
    else { toast('Erro ao excluir', 'error') }
    setBatchDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filterFns: Record<Filter, (c: Client) => boolean> = {
    all: () => true,
    with_briefing: c => c.stats.total > 0,
    no_briefing: c => c.stats.total === 0,
    with_ai: c => !!c.analysis && Object.keys(c.analysis).length > 0,
  }
  const sortFns: Record<SortKey, (a: Client, b: Client) => number> = {
    recent: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    name: (a, b) => a.company.localeCompare(b.company),
    briefings: (a, b) => b.stats.total - a.stats.total,
  }

  const filtered = clients.filter(filterFns[filter])
    .filter(c => !search || [c.company, c.name, c.email].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    .sort(sortFns[sort])

  const filterLabels: [Filter, string][] = [
    ['all', `Todos (${clients.length})`],
    ['with_briefing', `Com briefing (${clients.filter(filterFns.with_briefing).length})`],
    ['no_briefing', `Sem briefing (${clients.filter(filterFns.no_briefing).length})`],
    ['with_ai', `Com IA 🤖 (${clients.filter(filterFns.with_ai).length})`],
  ]

  const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="modal-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%' }}>
        {children}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <ToastContainer toasts={toasts} remove={remove} />
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, position: 'sticky', top: 0, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 20, padding: '4px 6px', borderRadius: 6, transition: 'color 0.15s' }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs
            <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>/ Clientes</span>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>+ Novo cliente</button>
      </header>

      <div style={{ padding: 16, maxWidth: 860, margin: '0 auto' }} className="page-in">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total de clientes', value: clients.length },
            { label: 'Com briefing', value: clients.filter(c => c.stats.total > 0).length },
            { label: 'Briefings concluídos', value: clients.reduce((a, c) => a + c.stats.concluido, 0) },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Buscar empresa, nome ou email..." style={{ flex: 1, minWidth: 0 }} />
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ width: 'auto', flexShrink: 0, paddingRight: 28 }}>
            <option value="recent">Mais recentes</option>
            <option value="name">A → Z</option>
            <option value="briefings">Mais briefings</option>
          </select>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {filterLabels.map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${filter === f ? 'var(--accent-border)' : 'var(--border)'}`, background: filter === f ? 'var(--accent-dim)' : 'transparent', color: filter === f ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Batch bar */}
        {selectedIds.size > 0 && (
          <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}><strong>{selectedIds.size}</strong> selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => setBatchDeleteConfirm(true)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>🗑️ Excluir {selectedIds.size}</button>
            </div>
          </div>
        )}

        {/* Select all */}
        {!loading && filtered.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 }}>
            <button onClick={() => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(c => c.id)))}
              style={{ fontSize: 11, color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              {selectedIds.size === filtered.length ? '☑ Desmarcar todos' : '☐ Selecionar todos'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({filtered.length})</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              {search ? 'Nenhum resultado' : filter !== 'all' ? 'Nenhum cliente neste filtro' : 'Nenhum cliente ainda'}
            </div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              {!search && filter === 'all' && 'Crie seu primeiro cliente para começar'}
            </div>
            {!search && filter === 'all' && (
              <button onClick={() => setShowNew(true)} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>+ Criar primeiro cliente</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => (
              <div key={c.id} className="bnny-card"
                style={{ background: selectedIds.has(c.id) ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${selectedIds.has(c.id) ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 12, padding: '13px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0, width: 15, height: 15 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => router.push(`/admin/clientes/${c.id}`)}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                      {c.company?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {c.company}{c.analysis && Object.keys(c.analysis).length > 0 && <span style={{ marginLeft: 6, fontSize: 11 }}>🤖</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}{c.email && ` · ${c.email}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center', minWidth: 32 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{c.stats.total}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>brief.</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 28 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c.stats.concluido > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{c.stats.concluido}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ok</div>
                    </div>
                    <button onClick={() => router.push(`/admin/clientes/${c.id}`)}
                      style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', transition: 'all 0.15s' }}>Ver →</button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}
                      style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,60,60,0.2)', background: 'transparent', color: '#ff6060', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NEW CLIENT */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Novo cliente</div>
            <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <form onSubmit={createClient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[{ label: 'Empresa *', key: 'company', placeholder: 'Nome da empresa' }, { label: 'Nome do contato *', key: 'name', placeholder: 'Nome completo' }, { label: 'Email', key: 'email', placeholder: 'email@empresa.com' }, { label: 'WhatsApp', key: 'phone', placeholder: '+55 47 99999-9999' }, { label: 'Site', key: 'website', placeholder: 'https://empresa.com' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input value={newForm[f.key as keyof typeof newForm]} onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button type="submit" disabled={saving || !newForm.name || !newForm.company} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: saving || !newForm.name || !newForm.company ? 0.6 : 1 }}>
                {saving ? 'Criando...' : 'Criar e ver perfil →'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Excluir cliente?</div>
            <div style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 6 }}><strong>{deleteTarget.company}</strong></div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 24, lineHeight: 1.6 }}>
              {deleteTarget.stats.total > 0 ? `Este cliente tem ${deleteTarget.stats.total} briefing${deleteTarget.stats.total > 1 ? 's' : ''} que também serão excluídos.` : 'Esta ação não pode ser desfeita.'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={deleteClient} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* BATCH DELETE */}
      {batchDeleteConfirm && (
        <Modal onClose={() => setBatchDeleteConfirm(false)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Excluir {selectedIds.size} clientes?</div>
            <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Todos os briefings associados também serão excluídos. Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBatchDeleteConfirm(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={batchDelete} disabled={batchDeleting} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                {batchDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
