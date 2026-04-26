'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useToast, ToastContainer } from '@/components/toast'
import { useRouter, useParams } from 'next/navigation'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'

interface Client {
  id: string; name: string; company: string; email: string; phone: string
  website: string | null; analysis: Record<string, unknown> | null; created_at: string
}
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string; language?: string
  created_at: string; completed_at: string | null; internal_notes: string | null
}

const STATUS_LABELS: Record<string, string> = { enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído' }
const STATUS_ICONS: Record<string, string> = { enviado: '📨', visualizado: '👁', em_andamento: '⏳', concluido: '✅' }

const AI_FIELDS = [
  { key: 'company_name', label: 'Nome da empresa' },
  { key: 'segment', label: 'Segmento / Nicho' },
  { key: 'description', label: 'Sobre a empresa' },
  { key: 'key_features', label: 'Produtos / Serviços principais' },
  { key: 'differentials', label: 'Diferenciais competitivos' },
  { key: 'unique_value_proposition', label: 'Proposta de valor única' },
  { key: 'target_audience', label: 'Público-alvo' },
  { key: 'brand_personality', label: 'Personalidade da marca' },
  { key: 'price_positioning', label: 'Posicionamento de preço' },
  { key: 'geographic_focus', label: 'Foco geográfico' },
  { key: 'tone_of_voice', label: 'Tom de voz' },
  { key: 'colors_hint', label: 'Direção de cores' },
  { key: 'extra_notes', label: 'Observações para design' },
]

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ClientePerfilPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', website: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // AI Analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [aiProfile, setAiProfile] = useState<Record<string, string>>({})
  const [editingAi, setEditingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [viewingResponses, setViewingResponses] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null)
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [copiedResponses, setCopiedResponses] = useState(false)
  const { toasts, toast, remove } = useToast()
  const [aiExpanded, setAiExpanded] = useState(false)
  const [analyzeUrl, setAnalyzeUrl] = useState('')
  const [extraText, setExtraText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/clients/${id}`)
    if (res.ok) {
      const d = await res.json()
      setClient(d.client)
      setBriefings(d.briefings || [])
      if (d.client.analysis) setAiProfile(d.client.analysis)
      if (d.client.website) setAnalyzeUrl(d.client.website)
      setEditForm({
        name: d.client.name || '', company: d.client.company || '',
        email: d.client.email || '', phone: d.client.phone || '',
        website: d.client.website || ''
      })
    } else if (res.status === 401) router.push('/admin')
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function saveEdit() {
    setSavingEdit(true)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm)
    })
    setSavingEdit(false); setEditMode(false); load()
  }

  async function analyzeWithAI() {
    if (!analyzeUrl && !extraText && !client?.company) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: analyzeUrl || client?.website, text: extraText, company: client?.company })
      })
      const data = await res.json()
      if (data.analysis) {
        setAiProfile(data.analysis)
        setEditingAi(true)
      }
    } catch (e) { console.error(e) }
    setAnalyzing(false)
  }

  async function saveAiProfile() {
    setSavingAi(true)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: aiProfile, website: analyzeUrl || client?.website })
    })
    setSavingAi(false); setEditingAi(false); load()
  }


  function renderFileValue(value: unknown): ReactNode {
    if (!value) return null

    const renderCard = (f: { url: string; name: string; size?: number; type?: string }, i: number) => {
      const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || '')
      const hasUrl = f.url && f.url.startsWith('http')
      const sizeLabel = f.size ? `${(f.size / 1024).toFixed(0)}kb` : ''
      if (isImage && hasUrl) return (
        <div key={i}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
            <img src={f.url} alt={f.name} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain', background: '#111', cursor: 'pointer' }} />
          </a>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{f.name}{sizeLabel ? ` · ${sizeLabel}` : ''}</div>
        </div>
      )
      if (hasUrl) return (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, textDecoration: 'none', color: 'var(--text)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 20 }}>{f.type?.includes('pdf') ? '📄' : '📎'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
            {sizeLabel && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sizeLabel}</div>}
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>↗ Abrir</span>
        </a>
      )
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)', opacity: 0.6 }}>
          <span style={{ fontSize: 20 }}>{isImage ? '🖼️' : '📎'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sizeLabel} · upload não concluído</div>
          </div>
        </div>
      )
    }

    if (Array.isArray(value)) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(value as { url: string; name: string; size?: number; type?: string }[]).map((f, i) => renderCard(f, i))}
      </div>
    )

    const str = String(value)
    const isUrl = str.startsWith('http')
    return isUrl
      ? <a href={str} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>📎 {str.split('/').pop()}</a>
      : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>📎 {str}</span>
  }

  async function viewResponses(slug: string) {
    setViewingResponses(slug)
    setLoadingResponses(true)
    const res = await fetch(`/api/briefings/${slug}/responses`)
    if (res.ok) { const d = await res.json(); setResponses(d.answers || {}) }
    setLoadingResponses(false)
  }

  async function copyResponses(briefingTitle: string) {
    if (!responses) return
    const lines = [`BRIEFING — ${briefingTitle}`, `Empresa: ${client?.company}`, '']
    Object.entries(responses).filter(([,v]) => v).forEach(([k, v]) => {
      const bLang = briefings.find(b => b.slug === viewingResponses)?.language
      const label = (bLang === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT)[k] || k.replace(/_/g, ' ').toUpperCase()
      lines.push(label.toUpperCase())
      lines.push(Array.isArray(v) ? (v as string[]).join(', ') : String(v))
      lines.push('')
    })
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedResponses(true)
    toast('Respostas copiadas!', 'success', 2000)
    setTimeout(() => setCopiedResponses(false), 2000)
  }

  function newBriefing() {
    router.push(`/admin/novo?client_id=${id}`)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>
  if (!client) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Cliente não encontrado</div>

  const hasAiProfile = Object.keys(aiProfile).length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <ToastContainer toasts={toasts} remove={remove} />
      <ToastContainer toasts={toasts} remove={remove} />
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, position: 'sticky', top: 0, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/admin/clientes')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: '4px 6px', borderRadius: 6 }}>←</button>
          <span style={{ color: 'var(--border-2)', fontSize: 14 }}>/</span>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, padding: '4px 6px', borderRadius: 6, fontFamily: 'inherit' }}>Painel</button>
          <span style={{ color: 'var(--border-2)', fontSize: 14 }}>/</span>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--accent)' }}>{client.company}</span>
          </div>
        </div>
        <button onClick={newBriefing} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>+ Novo briefing</button>
      </header>

      <div style={{ padding: 16, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }} className="page-in">

        {/* Client data card */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {client.company?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{client.company}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>cliente desde {fmt(client.created_at).split(',')[0]}</div>
              </div>
            </div>
            <button onClick={() => setEditMode(!editMode)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: `1px solid ${editMode ? 'var(--accent-border)' : 'var(--border)'}`, background: editMode ? 'var(--accent-dim)' : 'transparent', color: editMode ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}>
              {editMode ? '× Cancelar' : '✏️ Editar'}
            </button>
          </div>

          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Empresa', key: 'company' },
                { label: 'Nome do contato', key: 'name' },
                { label: 'Email', key: 'email' },
                { label: 'WhatsApp', key: 'phone' },
                { label: 'Site', key: 'website' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input value={editForm[f.key as keyof typeof editForm]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <button onClick={saveEdit} disabled={savingEdit} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Contato', value: client.name },
                { label: 'Email', value: client.email || '—' },
                { label: 'WhatsApp', value: client.phone || '—' },
                { label: 'Site', value: client.website || '—', link: client.website || undefined },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.label}</div>
                  {f.link ? (
                    <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>{f.value}</a>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{f.value}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Profile card */}
        <div style={{ background: 'var(--bg-2)', border: `1px solid ${hasAiProfile ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasAiProfile && !aiExpanded ? 0 : 16, cursor: hasAiProfile ? 'pointer' : 'default' }}
            onClick={() => hasAiProfile && setAiExpanded(e => !e)}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                🤖 Perfil de IA
                {hasAiProfile && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>Salvo</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                {hasAiProfile ? (aiExpanded ? 'Clique para recolher' : 'Clique para expandir e editar') : 'Sem perfil ainda — analise o site ou preencha manualmente'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasAiProfile && !editingAi && (
                <button onClick={e => { e.stopPropagation(); setEditingAi(true); setAiExpanded(true) }} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>✏️ Editar</button>
              )}
              {hasAiProfile && (
                <span style={{ color: 'var(--text-3)', fontSize: 18, transform: aiExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', display: 'inline-block' }}>⌄</span>
              )}
            </div>
          </div>

          {/* Collapsible content */}
          <div className={`collapsible-content ${!hasAiProfile || aiExpanded ? 'open' : 'closed'}`}>
          {/* Analyze section */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px', marginBottom: hasAiProfile ? 16 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
              {hasAiProfile ? '🔄 Re-analisar com IA' : '✨ Analisar com IA'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={analyzeUrl} onChange={e => setAnalyzeUrl(e.target.value)}
                placeholder="URL do site (opcional)"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              <textarea value={extraText} onChange={e => setExtraText(e.target.value)}
                placeholder="Informações extras sobre o cliente (opcional) — descreva o negócio, nicho, produtos, público..."
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }} />
              <button onClick={analyzeWithAI} disabled={analyzing} style={{ background: analyzing ? 'var(--bg-3)' : 'var(--accent)', color: analyzing ? 'var(--text-3)' : '#000', fontWeight: 700, padding: '9px', borderRadius: 8, border: 'none', cursor: analyzing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                {analyzing ? '⏳ Analisando com IA...' : hasAiProfile ? '🔄 Re-analisar' : '✨ Gerar perfil com IA'}
              </button>
            </div>
            {!analyzeUrl && !client.website && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Sem site? Use o campo de informações extras para descrever o negócio.</div>
            )}
          </div>

          {/* AI fields — view or edit */}
          {hasAiProfile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AI_FIELDS.map(f => {
                const val = aiProfile[f.key]
                if (!val && !editingAi) return null
                return (
                  <div key={f.key} style={{ borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '6px 12px', background: 'var(--bg-3)', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{f.label}</div>
                    {editingAi ? (
                      <textarea value={aiProfile[f.key] || ''} onChange={e => setAiProfile(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'none', color: 'var(--text)', fontSize: 13, lineHeight: 1.6, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, background: 'var(--bg-2)' }}>{String(val)}</div>
                    )}
                  </div>
                )
              })}
              {editingAi && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => { setEditingAi(false); if (client.analysis) setAiProfile(client.analysis as Record<string, string>) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancelar</button>
                  <button onClick={saveAiProfile} disabled={savingAi} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {savingAi ? 'Salvando...' : '💾 Salvar perfil'}
                  </button>
                </div>
              )}
            </div>
          )}
          </div>{/* end collapsible */}
        </div>

        {/* Briefings history */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Briefings</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{briefings.length} no histórico</div>
            </div>
            <button onClick={newBriefing} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Novo briefing</button>
          </div>

          {briefings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>
              Nenhum briefing ainda —{' '}
              <button onClick={newBriefing} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0, fontFamily: 'inherit' }}>criar o primeiro</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {briefings.map(b => (
                <div key={b.id} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>{b.type_label}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`status-badge status-${b.status}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 11 }}>
                          {STATUS_ICONS[b.status]} {STATUS_LABELS[b.status]}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(b.created_at)}</span>
                        {b.completed_at && <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>· concluído {fmt(b.completed_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${b.slug}`)}
                        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>🔗 Link</button>
                      {b.status === 'concluido' && (
                        <button onClick={() => viewResponses(b.slug)}
                          style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>Ver respostas</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      {/* RESPONSES MODAL */}
      {viewingResponses && (
        <div className="modal-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) { setViewingResponses(null); setResponses(null) } }}>
          <div className="modal-box" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{client?.company}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Respostas do briefing</div>
              </div>
              <button onClick={() => { setViewingResponses(null); setResponses(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={() => copyResponses(viewingResponses)}
                style={{ flex: 1, fontSize: 13, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {copiedResponses ? '✓ Copiado!' : '📋 Copiar tudo'}
              </button>
            </div>
            {loadingResponses ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : responses ? <ResponsesContent2
                responses={responses}
                language={briefings.find(b => b.slug === viewingResponses)?.language}
                companyName={client?.company || 'briefing'}
                renderFileValue={renderFileValue}
                labelMapPT={FIELD_LABELS_PT}
                labelMapEN={FIELD_LABELS_EN}
              /> : <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>Sem respostas ainda</div>}
          </div>
        </div>
      )}
    </div>
  )
}
