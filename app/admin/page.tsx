'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Client { id: string; name: string; company: string; email: string; phone: string }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  clients: Client
}

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído',
}
const STATUS_ICONS: Record<string, string> = {
  enviado: '📨', visualizado: '👁', em_andamento: '⏳', concluido: '✅',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `há ${mins}min`
  if (hours < 24) return `há ${hours}h`
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {STATUS_ICONS[status]} {STATUS_LABELS[status] || status}
    </span>
  )
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: wide ? 700 : 580, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'settings'>('list')
  const [responsesBriefing, setResponsesBriefing] = useState<Briefing | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [editBriefing, setEditBriefing] = useState<Briefing | null>(null)
  const [notesBriefing, setNotesBriefing] = useState<Briefing | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [settings, setSettings] = useState({ notification_email: '', notification_whatsapp: '', briefing_expiry_days: '30', reminder_days: '3' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [reminderSent, setReminderSent] = useState<string | null>(null)
  const [notifBriefing, setNotifBriefing] = useState<Briefing | null>(null)
  const [notifHistory, setNotifHistory] = useState<Array<{type: string; status: string; sent_at: string; details: Record<string, string>}>>([])
  const [sendingResend, setSendingResend] = useState<string | null>(null)
  const router = useRouter()

  const loadBriefings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/briefings')
    if (res.ok) { const data = await res.json(); setBriefings(data.briefings || []) }
    setLoading(false)
  }, [])

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings')
    if (res.ok) { const data = await res.json(); setSettings(s => ({ ...s, ...data.settings })) }
  }, [])

  useEffect(() => {
    fetch('/api/briefings').then(r => {
      if (r.status === 401) setAuthed(false)
      else { setAuthed(true); loadBriefings(); loadSettings() }
    })
  }, [loadBriefings, loadSettings])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (res.ok) { setAuthed(true); loadBriefings(); loadSettings() }
    else setLoginError('Senha incorreta')
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
    setCopiedId(slug); setTimeout(() => setCopiedId(null), 2000)
  }

  async function viewResponses(b: Briefing) {
    setResponsesBriefing(b); setResponses(null)
    const res = await fetch(`/api/briefings/${b.slug}/responses`)
    if (res.ok) { const data = await res.json(); setResponses(data.answers || {}) }
  }

  function buildText(b: Briefing, resp: Record<string, unknown>) {
    const lines = [`BRIEFING — ${b.type_label.toUpperCase()}`, `Empresa: ${b.clients?.company}`, `Contato: ${b.clients?.name}`, `Email: ${b.clients?.email || '—'}`, `WhatsApp: ${b.clients?.phone || '—'}`, `Concluído: ${fmt(b.completed_at)}`, '', '─────────────────────────────────', '']
    Object.entries(resp).forEach(([k, v]) => { if (!v) return; lines.push(k.replace(/_/g, ' ').toUpperCase()); lines.push(Array.isArray(v) ? (v as string[]).join(', ') : String(v)); lines.push('') })
    return lines.join('\n')
  }

  async function copyAll() {
    if (!responsesBriefing || !responses) return
    await navigator.clipboard.writeText(buildText(responsesBriefing, responses))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function exportPDF() {
    if (!responsesBriefing || !responses) return
    const b = responsesBriefing
    const fields = Object.entries(responses).filter(([, v]) => v)
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;padding:48px;max-width:800px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #c8ff00;margin-bottom:32px}.logo{font-size:22px;font-weight:800;letter-spacing:-0.04em}.logo span{color:#c8ff00;background:#111;padding:2px 8px;border-radius:4px}.badge{background:#111;color:#c8ff00;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;margin-top:6px;display:inline-block}.cb{background:#f8f8f8;border-radius:12px;padding:20px 24px;margin-bottom:32px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.cf label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;display:block;margin-bottom:3px}.st{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}.f{margin-bottom:18px}.fl{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.fv{font-size:14px;color:#111;line-height:1.6;background:#f8f8f8;padding:10px 14px;border-radius:8px;border-left:3px solid #c8ff00}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}</style></head><body><div class="hdr"><div><div class="logo"><span>Bnny</span> Labs</div><div style="font-size:12px;color:#555;margin-top:4px">Sistema de Briefings</div></div><div style="text-align:right"><div style="font-size:17px;font-weight:700">${b.type_label}</div><div class="badge">${STATUS_LABELS[b.status]||b.status}</div></div></div><div class="cb"><div class="cf"><label>Empresa</label><span style="font-size:15px;font-weight:700">${b.clients?.company||'—'}</span></div><div class="cf"><label>Contato</label><span>${b.clients?.name||'—'}</span></div><div class="cf"><label>Email</label><span>${b.clients?.email||'—'}</span></div><div class="cf"><label>WhatsApp</label><span>${b.clients?.phone||'—'}</span></div><div class="cf"><label>Concluído em</label><span>${fmt(b.completed_at)}</span></div><div class="cf"><label>Tipo</label><span>${b.type_label}</span></div></div><div class="st">Respostas do briefing</div>${fields.map(([k,v])=>`<div class="f"><div class="fl">${k.replace(/_/g,' ')}</div><div class="fv">${Array.isArray(v)?(v as string[]).join(', '):String(v)}</div></div>`).join('')}<div class="footer">Gerado por Bnny Labs · briefing.bnnylabs.com · ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  async function saveSettings() {
    setSavingSettings(true)
    await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000)
  }

  function openEdit(b: Briefing) {
    setEditBriefing(b)
    setEditForm({ name: b.clients?.name || '', company: b.clients?.company || '', email: b.clients?.email || '', phone: b.clients?.phone || '' })
  }

  async function saveEdit() {
    if (!editBriefing) return
    setSavingEdit(true)
    await fetch(`/api/admin/clients/${editBriefing.clients?.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
    setSavingEdit(false); setEditBriefing(null); loadBriefings()
  }

  async function saveNotes() {
    if (!notesBriefing) return
    setSavingNotes(true)
    await fetch(`/api/briefings/${notesBriefing.slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ internal_notes: notesText }) })
    setSavingNotes(false); setNotesBriefing(null); loadBriefings()
  }

  async function sendReminder(b: Briefing) {
    setSendingReminder(b.id)
    await fetch(`/api/admin/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: b.slug, type: 'reminder' }) })
    setSendingReminder(null); setReminderSent(b.id); setTimeout(() => setReminderSent(null), 3000)
  }

  async function resendLink(b: Briefing) {
    await copyLink(b.slug)
  }

  async function viewNotifications(b: Briefing) {
    setNotifBriefing(b)
    const res = await fetch(`/api/briefings/${b.slug}/notifications`)
    if (res.ok) { const data = await res.json(); setNotifHistory(data.notifications || []) }
  }

  async function resendEmail(b: Briefing) {
    setSendingResend(b.id)
    const res = await fetch('/api/admin/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: b.slug, type: 'resend' })
    })
    const data = await res.json()
    setSendingResend(null)
    if (data.emailSent) {
      setReminderSent(b.id + '_resend')
      setTimeout(() => setReminderSent(null), 3000)
    }
  }

  const filtered = briefings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search) { const q = search.toLowerCase(); if (!b.clients?.company?.toLowerCase().includes(q) && !b.clients?.name?.toLowerCase().includes(q) && !b.type_label?.toLowerCase().includes(q)) return false }
    if (dateFrom && new Date(b.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(b.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const counts = { all: briefings.length, enviado: briefings.filter(b=>b.status==='enviado').length, visualizado: briefings.filter(b=>b.status==='visualizado').length, em_andamento: briefings.filter(b=>b.status==='em_andamento').length, concluido: briefings.filter(b=>b.status==='concluido').length }

  if (authed === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  if (!authed) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 340 }} className="animate-in">
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}><span style={{ color: 'var(--accent)' }}>Bnny</span> Labs</div>
          <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Painel de Briefings</div>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
            {loginError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{loginError}</div>}
          </div>
          <button type="submit" style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14 }}>Entrar</button>
        </form>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', cursor: 'pointer' }} onClick={() => setView('list')}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>Briefings</span><span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>v2</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView(view === 'settings' ? 'list' : 'settings')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'settings' ? 'var(--accent-border)' : 'var(--border)'}`, background: view === 'settings' ? 'var(--accent-dim)' : 'transparent', color: view === 'settings' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>⚙️ Config</button>
          <button onClick={() => router.push('/admin/novo')} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>+ Novo</button>
        </div>
      </header>

      <div style={{ padding: '20px', maxWidth: 860, margin: '0 auto' }}>

        {/* SETTINGS */}
        {view === 'settings' && (
          <div className="animate-in">
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 22, letterSpacing: '-0.02em' }}>Configurações</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500 }}>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📬 Notificações</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Email que recebe notificações</label>
                    <input value={settings.notification_email} onChange={e => setSettings(s => ({ ...s, notification_email: e.target.value }))} placeholder="seu@email.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>WhatsApp para notificações</label>
                    <input value={settings.notification_whatsapp} onChange={e => setSettings(s => ({ ...s, notification_whatsapp: e.target.value }))} placeholder="+55 47 99999-9999" />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Em breve — integração com WhatsApp API</div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>⏱ Prazos automáticos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Validade padrão do link (dias)</label>
                    <input type="number" value={settings.briefing_expiry_days} onChange={e => setSettings(s => ({ ...s, briefing_expiry_days: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Lembrete automático após X dias sem resposta</label>
                    <input type="number" value={settings.reminder_days} onChange={e => setSettings(s => ({ ...s, reminder_days: e.target.value }))} />
                  </div>
                </div>
              </div>
              <button onClick={saveSettings} disabled={savingSettings} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                {settingsSaved ? '✓ Salvo!' : savingSettings ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>
        )}

        {/* LIST */}
        {view === 'list' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
              {(['all', 'enviado', 'visualizado', 'em_andamento', 'concluido'] as const).map(key => (
                <button key={key} onClick={() => setStatusFilter(key)} style={{ background: statusFilter === key ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${statusFilter === key ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: statusFilter === key ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{counts[key]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key === 'all' ? 'Total' : key === 'em_andamento' ? 'Andamento' : STATUS_LABELS[key]}</div>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Buscar por cliente, empresa ou tipo..."
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%' }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Período:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>até</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}>Limpar ×</button>
                )}
              </div>
            </div>

            {/* List */}
            {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
            : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14 }}>{search || dateFrom || dateTo ? 'Nenhum resultado' : 'Nenhum briefing ainda'}</div>
                {!search && !dateFrom && !dateTo && <button onClick={() => router.push('/admin/novo')} style={{ marginTop: 16, background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>Criar primeiro briefing</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(b => (
                  <div key={b.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    
                    {/* Row 1: name + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{b.clients?.company}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {/* Edit */}
                        <button onClick={() => openEdit(b)} title="Editar cliente"
                          style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>✏️</button>
                        {/* Notes */}
                        <button onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }} title="Anotações internas"
                          style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${b.internal_notes ? 'var(--accent-border)' : 'var(--border)'}`, background: b.internal_notes ? 'var(--accent-dim)' : 'transparent', color: b.internal_notes ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>📝</button>
                        {/* Notification history */}
                        <button onClick={() => viewNotifications(b)} title="Histórico de envios"
                          style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>📬</button>
                        {/* Resend email - non-concluded */}
                        {b.status !== 'concluido' && b.clients?.email && (
                          <button onClick={() => resendEmail(b)} disabled={sendingResend === b.id}
                            title={`Reenviar email para ${b.clients.email}`}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${reminderSent === b.id + '_resend' ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id + '_resend' ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id + '_resend' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {sendingResend === b.id ? '...' : reminderSent === b.id + '_resend' ? '✓ Reenviado' : '📧 Reenviar'}
                          </button>
                        )}
                        {/* Reminder - only for non-concluded */}
                        {b.status !== 'concluido' && (
                          <button onClick={() => sendReminder(b)} disabled={sendingReminder === b.id}
                            title="Enviar lembrete"
                            style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${reminderSent === b.id ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {sendingReminder === b.id ? '...' : reminderSent === b.id ? '✓' : '🔔'}
                          </button>
                        )}
                        {/* Copy link */}
                        <button onClick={() => resendLink(b)}
                          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {copiedId === b.slug ? '✓ Copiado' : '🔗 Link'}
                        </button>
                        {/* Responses */}
                        {b.status === 'concluido' && (
                          <button onClick={() => viewResponses(b)}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Ver respostas
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <StatusBadge status={b.status} />
                      <span style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{b.type_label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{b.clients?.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>· {timeAgo(b.created_at)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>({fmt(b.created_at)})</span>
                      {b.completed_at && <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>· concluído {fmt(b.completed_at)}</span>}
                      {b.expires_at && new Date(b.expires_at) > new Date() && <span style={{ fontSize: 11, color: '#ffd700', whiteSpace: 'nowrap' }}>· expira {fmt(b.expires_at)}</span>}
                      {b.expires_at && new Date(b.expires_at) < new Date() && <span style={{ fontSize: 11, color: '#ff4545', whiteSpace: 'nowrap' }}>· expirado</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* RESPONSES MODAL */}
      {responsesBriefing && (
        <Modal onClose={() => { setResponsesBriefing(null); setResponses(null) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{responsesBriefing.clients?.company}</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 3 }}>{responsesBriefing.type_label} · {responsesBriefing.clients?.name}</div>
              {responsesBriefing.clients?.email && <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{responsesBriefing.clients.email} · {responsesBriefing.clients.phone}</div>}
            </div>
            <button onClick={() => { setResponsesBriefing(null); setResponses(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={copyAll} style={{ flex: 1, fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? '✓ Copiado!' : '📋 Copiar tudo'}</button>
            <button onClick={exportPDF} style={{ flex: 1, fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>📄 Exportar PDF</button>
          </div>
          {responses ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(responses).filter(([,v]) => v).map(([key, value]) => (
                <div key={key}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{key.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', background: 'var(--bg-3)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', lineHeight: 1.6 }}>{Array.isArray(value) ? (value as string[]).join(', ') : String(value)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>}
        </Modal>
      )}

      {/* EDIT CLIENT MODAL */}
      {editBriefing && (
        <Modal onClose={() => setEditBriefing(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Editar cliente</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Após salvar, copie o link e reenvie se necessário</div>
            </div>
            <button onClick={() => setEditBriefing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[{ label: 'Empresa', key: 'company' as const }, { label: 'Nome do contato', key: 'name' as const }, { label: 'Email', key: 'email' as const }, { label: 'WhatsApp', key: 'phone' as const }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-3)' }}>
              💡 Após salvar, use o botão 🔗 Link para copiar e reenviar o briefing ao novo email.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditBriefing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveEdit} disabled={savingEdit} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* NOTIFICATION HISTORY MODAL */}
      {notifBriefing && (
        <Modal onClose={() => { setNotifBriefing(null); setNotifHistory([]) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Histórico de envios</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{notifBriefing.clients?.company} · {notifBriefing.type_label}</div>
            </div>
            <button onClick={() => { setNotifBriefing(null); setNotifHistory([]) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          {notifBriefing.clients?.email && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 16 }}>
              📧 Email do cliente: <strong style={{ color: 'var(--text)' }}>{notifBriefing.clients.email}</strong>
            </div>
          )}
          {notifHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Nenhum envio registrado ainda</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifHistory.map((n, i) => {
                const typeLabels: Record<string, string> = { email_client: '📧 Email pro cliente', email_admin: '📧 Email pro admin', reminder: '🔔 Lembrete', resend: '📧 Reenvio' }
                return (
                  <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeLabels[n.type] || n.type}</span>
                      <span style={{ fontSize: 11, color: n.status === 'sent' ? 'var(--accent)' : '#ff4545', fontWeight: 600 }}>{n.status === 'sent' ? '✓ Enviado' : '✗ Falhou'}</span>
                    </div>
                    {n.details?.to && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Para: {n.details.to}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{new Date(n.sent_at).toLocaleString('pt-BR')}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {/* NOTES MODAL */}
      {notesBriefing && (
        <Modal onClose={() => setNotesBriefing(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Anotações internas</div>
            <button onClick={() => setNotesBriefing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Visível só para você — o cliente não vê</div>
          <textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Anote aqui qualquer informação sobre o cliente ou projeto..." style={{ minHeight: 140, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setNotesBriefing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
            <button onClick={saveNotes} disabled={savingNotes} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>{savingNotes ? 'Salvando...' : 'Salvar anotação'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
