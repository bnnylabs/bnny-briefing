'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ClientStats { total: number; concluido: number; last_at: string | null }
interface Client {
  id: string; name: string; company: string; email: string; phone: string
  website: string | null; analysis: Record<string, unknown> | null
  created_at: string; stats: ClientStats
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ClientesPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', company: '', email: '', phone: '', website: '' })
  const [saving, setSaving] = useState(false)

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
      router.push(`/admin/clientes/${d.client.id}`)
    }
    setSaving(false)
  }

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.company?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>Clientes</span>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>+ Novo cliente</button>
      </header>

      <div style={{ padding: 16, maxWidth: 860, margin: '0 auto' }}>
        {/* Stats bar */}
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

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Buscar por empresa, nome ou email..."
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 14 }}>{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}</div>
            {!search && <button onClick={() => setShowNew(true)} style={{ marginTop: 16, background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>Criar primeiro cliente</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => (
              <div key={c.id}
                onClick={() => router.push(`/admin/clientes/${c.id}`)}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  {/* Left: avatar + info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                      {c.company?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}{c.email && ` · ${c.email}`}
                      </div>
                    </div>
                  </div>
                  {/* Right: stats */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{c.stats.total}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>briefings</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: c.stats.concluido > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{c.stats.concluido}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>concluídos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.stats.last_at ? fmt(c.stats.last_at) : '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>último</div>
                    </div>
                    {c.analysis && <span title="Perfil IA disponível" style={{ fontSize: 16 }}>🤖</span>}
                    <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New client modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Novo cliente</div>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <form onSubmit={createClient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Empresa *', key: 'company', placeholder: 'Nome da empresa' },
                { label: 'Nome do contato *', key: 'name', placeholder: 'Nome completo' },
                { label: 'Email', key: 'email', placeholder: 'email@empresa.com' },
                { label: 'WhatsApp', key: 'phone', placeholder: '+55 47 99999-9999' },
                { label: 'Site', key: 'website', placeholder: 'https://empresa.com' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input
                    value={newForm[f.key as keyof typeof newForm]}
                    onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.label.includes('*')}
                  />
                </div>
              ))}
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-3)' }}>
                💡 Após criar, você poderá analisar o site com IA e criar briefings para este cliente.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
                <button type="submit" disabled={saving || !newForm.name || !newForm.company} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: saving || !newForm.name || !newForm.company ? 0.6 : 1 }}>
                  {saving ? 'Criando...' : 'Criar e ver perfil →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
