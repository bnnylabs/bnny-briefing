'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_LABELS_PT } from '@/lib/briefing-types'
import { useToast, ToastContainer } from '@/components/toast'

interface Client { id: string; name: string; company: string; email: string; phone: string }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  clients: Client
}
interface ActivityLog {
  id: string; action: string; details: Record<string, unknown>; created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído',
}
const STATUS_ICONS: Record<string, string> = {
  enviado: '📨', visualizado: '👁', em_andamento: '⏳', concluido: '✅',
}
const ACTION_LABELS: Record<string, string> = {
  delete_briefing: '🗑️ Briefing excluído',
  bulk_delete_briefings: '🗑️ Exclusão em lote',
  duplicate_briefing: '📋 Briefing duplicado',
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
    <div className="modal-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: wide ? 720 : 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
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
  const [view, setView] = useState<'list' | 'settings' | 'log'>('list')
  const { toasts, toast, remove: removeToast } = useToast()

  const [responsesBriefing, setResponsesBriefing] = useState<Briefing | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [editBriefing, setEditBriefing] = useState<Briefing | null>(null)
  const [notesBriefing, setNotesBriefing] = useState<Briefing | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [reminderSent, setReminderSent] = useState<string | null>(null)
  const [notifBriefing, setNotifBriefing] = useState<Briefing | null>(null)
  const [notifHistory, setNotifHistory] = useState<Array<{type: string; status: string; sent_at: string; details: Record<string, string>}>>([])
  const [sendingResend, setSendingResend] = useState<string | null>(null)

  const [deleteBriefing, setDeleteBriefing] = useState<Briefing | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [duplicatedSlug, setDuplicatedSlug] = useState<string | null>(null)
  const [dupLink, setDupLink] = useState('')

  const [clientHistoryClient, setClientHistoryClient] = useState<Client | null>(null)
  const [clientHistoryBriefings, setClientHistoryBriefings] = useState<Briefing[]>([])

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const [settings, setSettings] = useState({ notification_email: '', notification_whatsapp: '', briefing_expiry_days: '30', reminder_days: '3' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

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

  const loadActivityLog = useCallback(async () => {
    setLogsLoading(true)
    const res = await fetch('/api/admin/activity-log')
    if (res.ok) { const data = await res.json(); setActivityLogs(data.logs || []) }
    setLogsLoading(false)
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
    toast('Link copiado!', 'success', 2000)
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
    toast('Respostas copiadas!', 'success', 2000)
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
    toast('Cliente atualizado', 'success')
  }

  async function saveNotes() {
    if (!notesBriefing) return
    setSavingNotes(true)
    await fetch(`/api/briefings/${notesBriefing.slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ internal_notes: notesText }) })
    setSavingNotes(false); setNotesBriefing(null); loadBriefings()
    toast('Anotação salva', 'success')
  }

  async function sendReminder(b: Briefing) {
    setSendingReminder(b.id)
    await fetch(`/api/admin/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: b.slug, type: 'reminder' }) })
    setSendingReminder(null); setReminderSent(b.id); setTimeout(() => setReminderSent(null), 3000)
  }

  async function viewNotifications(b: Briefing) {
    setNotifBriefing(b)
    const res = await fetch(`/api/briefings/${b.slug}/notifications`)
    if (res.ok) { const data = await res.json(); setNotifHistory(data.notifications || []) }
  }

  async function resendEmail(b: Briefing) {
    setSendingResend(b.id)
    const res = await fetch('/api/admin/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: b.slug, type: 'resend' })
    })
    const data = await res.json()
    setSendingResend(null)
    if (data.emailSent) { setReminderSent(b.id + '_resend'); setTimeout(() => setReminderSent(null), 3000) }
  }

  async function confirmDelete() {
    if (!deleteBriefing) return
    setDeleting(true)
    await fetch(`/api/briefings/${deleteBriefing.slug}`, { method: 'DELETE' })
    setDeleting(false); setDeleteBriefing(null); loadBriefings()
    toast('Briefing excluído', 'success')
  }

  async function confirmBatchDelete() {
    if (selectedIds.size === 0) return
    setBatchDeleting(true)
    const slugs = filtered.filter(b => selectedIds.has(b.id)).map(b => b.slug)
    await fetch('/api/admin/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs }) })
    setBatchDeleting(false); setBatchDeleteConfirm(false); setSelectedIds(new Set()); loadBriefings()
    toast(`${slugs.length} briefing${slugs.length > 1 ? 's' : ''} excluído${slugs.length > 1 ? 's' : ''}`, 'success')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(b => b.id)))
  }

  async function duplicateBriefing(b: Briefing) {
    setDuplicating(b.id)
    const res = await fetch(`/api/briefings/${b.slug}/duplicate`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setDuplicatedSlug(data.briefing?.slug)
      setDupLink(data.link || '')
      await loadBriefings()
      toast('Briefing duplicado!', 'success')
    }
    setDuplicating(null)
  }

  function viewClientHistory(client: Client) {
    setClientHistoryClient(client)
    setClientHistoryBriefings(briefings.filter(b => b.clients?.id === client.id))
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
      <ToastContainer toasts={toasts} remove={removeToast} />
      <style>{`
        .card-row1 { display: flex; align-items: center; gap: 10px; }
        .card-name { font-weight: 700; font-size: 15px; background: none; border: none; cursor: pointer; color: var(--text); padding: 0; text-align: left; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .card-btns { display: flex; gap: 5px; align-items: center; flex-shrink: 0; }
        .card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; margin-left: 25px; }
        .card-extra-btns { display: none; }
        @media (max-width: 700px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .filter-outer { flex-direction: column !important; gap: 8px !important; }
          .search-wrap { width: 100% !important; }
          .date-wrap { width: 100% !important; justify-content: flex-start !important; }
          .date-input { flex: 1 !important; min-width: 0 !important; }
          .card-btns { display: none !important; }
          .card-extra-btns { display: flex !important; flex-wrap: wrap; gap: 5px; margin-top: 8px; margin-left: 25px; }
          .header-btns button { padding: 5px 9px !important; font-size: 11px !important; }
        }
      `}</style>

      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', zIndex: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', cursor: 'pointer' }} onClick={() => setView('list')}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>Briefings</span><span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>v2</span>
        </div>
        <div className="header-btns" style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => router.push('/admin/clientes')} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>👥 Clientes</button>
          <button onClick={() => { setView('log'); loadActivityLog() }} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: `1px solid ${view === 'log' ? 'var(--accent-border)' : 'var(--border)'}`, background: view === 'log' ? 'var(--accent-dim)' : 'transparent', color: view === 'log' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>📋 Log</button>
          <button onClick={() => setView(view === 'settings' ? 'list' : 'settings')} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: `1px solid ${view === 'settings' ? 'var(--accent-border)' : 'var(--border)'}`, background: view === 'settings' ? 'var(--accent-dim)' : 'transparent', color: view === 'settings' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>⚙️ Config</button>
          <button onClick={() => router.push('/admin/novo')} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>+ Novo</button>
        </div>
      </header>

      <div style={{ padding: '16px', maxWidth: 860, margin: '0 auto' }}>

        {/* ACTIVITY LOG */}
        {view === 'log' && (
          <div className="page-in">
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 20, letterSpacing: '-0.02em' }}>📋 Log de Atividades</h2>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : activityLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                Nenhuma atividade registrada ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activityLogs.map(log => (
                  <div key={log.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{ACTION_LABELS[log.action] || log.action}</div>
                        {log.details?.company ? <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{String(log.details.company)} · {String(log.details.type_label ?? '')}</div> : null}
                        {log.details?.count ? <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{String(log.details.count)} briefings excluídos</div> : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(log.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {view === 'settings' && (
          <div className="page-in">
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
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Um cron job envia lembretes automáticos para briefings pendentes após esse prazo</div>
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
            {/* Stats — 2 cols on mobile, 5 on desktop */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
              {(['all', 'enviado', 'visualizado', 'em_andamento', 'concluido'] as const).map(key => (
                <button key={key} onClick={() => setStatusFilter(key)} style={{ background: statusFilter === key ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${statusFilter === key ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: statusFilter === key ? 'var(--accent)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{counts[key]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key === 'all' ? 'Total' : key === 'em_andamento' ? 'Andamento' : STATUS_LABELS[key]}</div>
                </button>
              ))}
            </div>

            {/* Batch delete bar */}
            {selectedIds.size > 0 && (
              <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text)' }}>{selectedIds.size}</strong> selecionado{selectedIds.size > 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => setBatchDeleteConfirm(true)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>🗑️ Excluir {selectedIds.size}</button>
                </div>
              </div>
            )}

            {/* Filters — search + date (date goes below on mobile) */}
            <div className="filter-outer" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <div className="search-wrap" style={{ flex: 1, minWidth: 0 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Buscar cliente, empresa ou tipo..."
                  style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div className="date-wrap" style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <input type="date" className="date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
                <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>→</span>
                <input type="date" className="date-input" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, padding: '6px 8px', lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
            </div>

            {/* Select all */}
            {filtered.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 }}>
                <button onClick={toggleSelectAll} style={{ fontSize: 11, color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {selectedIds.size === filtered.length ? '☑ Desmarcar todos' : '☐ Selecionar todos'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({filtered.length})</span>
              </div>
            )}

            {/* List */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton" style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0 }} />
                      <div className="skeleton" style={{ flex: 1, height: 15, maxWidth: 200 }} />
                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                        <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, marginLeft: 25 }}>
                      <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 20 }} />
                      <div className="skeleton" style={{ width: 100, height: 22, borderRadius: 6 }} />
                      <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )
            : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                  {search || dateFrom || dateTo ? 'Nenhum resultado para este filtro' : 'Nenhum briefing ainda'}
                </div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>
                  {search || dateFrom || dateTo ? 'Tente ajustar os filtros' : 'Crie o primeiro briefing para começar'}
                </div>
                {!search && !dateFrom && !dateTo && <button onClick={() => router.push('/admin/clientes')} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>Criar primeiro briefing</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(b => (
                  <div key={b.id} style={{ background: selectedIds.has(b.id) ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${selectedIds.has(b.id) ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { if (!selectedIds.has(b.id)) e.currentTarget.style.borderColor = 'var(--border-2)' }}
                    onMouseLeave={e => { if (!selectedIds.has(b.id)) e.currentTarget.style.borderColor = 'var(--border)' }}>

                    {/* Row 1 (desktop): [☐] [Company name ———————] [all buttons] */}
                    {/* Row 1 (mobile): [☐] [Company name] */}
                    <div className="card-row1">
                      <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelect(b.id)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0, width: 15, height: 15 }} />
                      <button onClick={() => viewClientHistory(b.clients)} className="card-name" title="Ver histórico deste cliente">
                        {b.clients?.company}
                      </button>
                      {/* Desktop buttons — hidden on mobile via CSS */}
                      <div className="card-btns">
                        <button onClick={() => openEdit(b)} title="Editar" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }} title="Anotações" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${b.internal_notes ? 'var(--accent-border)' : 'var(--border)'}`, background: b.internal_notes ? 'var(--accent-dim)' : 'transparent', color: b.internal_notes ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>📝</button>
                        <button onClick={() => viewNotifications(b)} title="Histórico de envios" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>📬</button>
                        <button onClick={() => duplicateBriefing(b)} disabled={duplicating === b.id} title="Duplicar" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', opacity: duplicating === b.id ? 0.5 : 1 }}>{duplicating === b.id ? '⏳' : '⿻'}</button>
                        {b.status !== 'concluido' && b.clients?.email && (
                          <button onClick={() => resendEmail(b)} disabled={sendingResend === b.id} title="Reenviar email" style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${reminderSent === b.id + '_resend' ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id + '_resend' ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id + '_resend' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {sendingResend === b.id ? '...' : reminderSent === b.id + '_resend' ? '✓' : '📧 Reenviar'}
                          </button>
                        )}
                        {b.status !== 'concluido' && (
                          <button onClick={() => sendReminder(b)} disabled={sendingReminder === b.id} title="Lembrete" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${reminderSent === b.id ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
                            {sendingReminder === b.id ? '...' : reminderSent === b.id ? '✓' : '🔔'}
                          </button>
                        )}
                        <button onClick={() => copyLink(b.slug)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {copiedId === b.slug ? '✓' : '🔗 Link'}
                        </button>
                        {b.status === 'concluido' && (
                          <button onClick={() => viewResponses(b)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Ver respostas</button>
                        )}
                        <button onClick={() => setDeleteBriefing(b)} title="Excluir" style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,60,60,0.25)', background: 'transparent', color: '#ff6060', cursor: 'pointer' }}>🗑️</button>
                      </div>
                    </div>
                    {/* Mobile buttons — shown only on mobile via CSS */}
                    <div className="card-extra-btns">
                      <button onClick={() => openEdit(b)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>✏️ Editar</button>
                      <button onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${b.internal_notes ? 'var(--accent-border)' : 'var(--border)'}`, background: b.internal_notes ? 'var(--accent-dim)' : 'transparent', color: b.internal_notes ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>📝 Notas</button>
                      <button onClick={() => viewNotifications(b)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>📬</button>
                      <button onClick={() => duplicateBriefing(b)} disabled={duplicating === b.id} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>{duplicating === b.id ? '⏳' : '⿻ Duplicar'}</button>
                      {b.status !== 'concluido' && b.clients?.email && (
                        <button onClick={() => resendEmail(b)} disabled={sendingResend === b.id} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${reminderSent === b.id + '_resend' ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id + '_resend' ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id + '_resend' ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}>
                          {reminderSent === b.id + '_resend' ? '✓ Reenviado' : '📧 Reenviar'}
                        </button>
                      )}
                      {b.status !== 'concluido' && (
                        <button onClick={() => sendReminder(b)} disabled={sendingReminder === b.id} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${reminderSent === b.id ? 'var(--accent-border)' : 'var(--border)'}`, background: reminderSent === b.id ? 'var(--accent-dim)' : 'transparent', color: reminderSent === b.id ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
                          {reminderSent === b.id ? '✓ Enviado' : '🔔 Lembrete'}
                        </button>
                      )}
                      <button onClick={() => copyLink(b.slug)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
                        {copiedId === b.slug ? '✓ Copiado' : '🔗 Link'}
                      </button>
                      {b.status === 'concluido' && (
                        <button onClick={() => viewResponses(b)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>Ver respostas</button>
                      )}
                      <button onClick={() => setDeleteBriefing(b)} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(255,60,60,0.25)', background: 'transparent', color: '#ff6060', cursor: 'pointer' }}>🗑️ Excluir</button>
                    </div>
                    {/* Meta row — both desktop and mobile */}
                    <div className="card-meta">
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

      </div>{/* end padding wrapper */}

      {/* RESPONSES MODAL — redesigned */}
      {responsesBriefing && (
        <Modal onClose={() => { setResponsesBriefing(null); setResponses(null) }} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>{responsesBriefing.clients?.company}</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 10, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{responsesBriefing.type_label}</span>
                <span>{responsesBriefing.clients?.name}</span>
                {responsesBriefing.clients?.email && <span style={{ color: 'var(--text-3)' }}>· {responsesBriefing.clients.email}</span>}
              </div>
              {responsesBriefing.completed_at && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Concluído em {fmt(responsesBriefing.completed_at)}</div>}
            </div>
            <button onClick={() => { setResponsesBriefing(null); setResponses(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button onClick={copyAll} style={{ flex: 1, fontSize: 13, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? '✓ Copiado!' : '📋 Copiar tudo'}</button>
            <button onClick={exportPDF} style={{ flex: 1, fontSize: 13, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>📄 Exportar PDF</button>
          </div>
          {responses ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(responses).filter(([, v]) => v).map(([key, value]) => {
                const displayValue = Array.isArray(value) ? (value as string[]).join(', ') : String(value)
                const isFile = /arquivo|logo|referencia|anexo|upload/i.test(key)
                const isShort = displayValue.length < 60
                return (
                  <div key={key} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderBottom: isShort ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {isFile && '📎 '}{FIELD_LABELS_PT[key] || key.replace(/_/g, ' ')}
                      </span>
                      {isShort && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{displayValue}</span>}
                    </div>
                    {!isShort && (
                      <div style={{ padding: '12px 14px', fontSize: 14, color: 'var(--text)', lineHeight: 1.7, background: 'var(--bg-2)', whiteSpace: 'pre-wrap' }}>
                        {isFile ? (
                          <a href={displayValue} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                            📎 {displayValue}
                          </a>
                        ) : displayValue}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>}
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {deleteBriefing && (
        <Modal onClose={() => setDeleteBriefing(null)}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Excluir briefing?</div>
            <div style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 6 }}><strong style={{ color: 'var(--text)' }}>{deleteBriefing.clients?.company}</strong> — {deleteBriefing.type_label}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 24 }}>Esta ação não pode ser desfeita. Todas as respostas e notificações serão excluídas.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteBriefing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* BATCH DELETE CONFIRM */}
      {batchDeleteConfirm && (
        <Modal onClose={() => setBatchDeleteConfirm(false)}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Excluir {selectedIds.size} briefings?</div>
            <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBatchDeleteConfirm(false)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={confirmBatchDelete} disabled={batchDeleting} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#ff3c3c', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                {batchDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DUPLICATE RESULT */}
      {duplicatedSlug && (
        <Modal onClose={() => { setDuplicatedSlug(null); setDupLink('') }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⿻</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Briefing duplicado!</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>Novo briefing criado com status <strong>Enviado</strong>.</div>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Novo link</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{dupLink}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => { await navigator.clipboard.writeText(dupLink); setDuplicatedSlug(null); setDupLink('') }} style={{ flex: 1, background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>📋 Copiar link</button>
              <button onClick={() => { setDuplicatedSlug(null); setDupLink('') }} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Fechar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* CLIENT HISTORY */}
      {clientHistoryClient && (
        <Modal onClose={() => setClientHistoryClient(null)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 19 }}>👤 {clientHistoryClient.company}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{clientHistoryClient.name} · {clientHistoryClient.email || '—'}</div>
            </div>
            <button onClick={() => setClientHistoryClient(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {clientHistoryBriefings.length} briefing{clientHistoryBriefings.length !== 1 ? 's' : ''} no histórico
          </div>
          {clientHistoryBriefings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Nenhum briefing encontrado</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientHistoryBriefings.map(b => (
                <div key={b.id} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{b.type_label}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusBadge status={b.status} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Criado {fmt(b.created_at)}</span>
                        {b.completed_at && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· Concluído {fmt(b.completed_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => copyLink(b.slug)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>🔗 Link</button>
                      {b.status === 'concluido' && (
                        <button onClick={() => { setClientHistoryClient(null); viewResponses(b) }} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>Ver respostas</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              💡 Após salvar, use 🔗 Link para copiar e reenviar o briefing.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditBriefing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancelar</button>
              <button onClick={saveEdit} disabled={savingEdit} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* NOTIFICATION HISTORY */}
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
              📧 Email: <strong style={{ color: 'var(--text)' }}>{notifBriefing.clients.email}</strong>
            </div>
          )}
          {notifHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Nenhum envio registrado</div>
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
