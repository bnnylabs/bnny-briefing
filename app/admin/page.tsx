'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { useToast, ToastContainer } from '@/components/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

interface Client { id: string; name: string; company: string; email: string; phone: string }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  language?: string; editing_locked?: boolean; editing_expires_at?: string | null; update_count?: number; clients: Client
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
  // ─── STATUS BADGE ─────────────────────────────────────────────────────────
  // Already defined above as function StatusBadge

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (authed === null) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="spinner" />
    </div>
  )

  if (authed === false) return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">B</div>
            <span className="font-bold text-xl tracking-tight">Bnny <span className="text-primary">Labs</span></span>
          </div>
          <p className="text-muted-foreground text-sm">Painel de briefings</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Senha de acesso" autoFocus className="h-11 text-base" />
          {loginError && <p className="text-destructive text-sm text-center">{loginError}</p>}
          <Button type="submit" className="h-11 text-base">Entrar</Button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* ── ACTIVITY LOG ─────────────────────────────────────────── */}
        {view === 'log' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-bold tracking-tight">Log de Atividades</h1>
              <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">← Voltar</button>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-medium">Nenhuma atividade registrada ainda</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {activityLogs.map(log => (
                  <div key={log.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm">{ACTION_LABELS[log.action] || log.action}</div>
                      {log.details?.company ? <div className="text-xs text-muted-foreground mt-1">{String(log.details.company)} · {String(log.details.type_label ?? '')}</div> : null}
                      {log.details?.count ? <div className="text-xs text-muted-foreground mt-1">{String(log.details.count)} briefings excluídos</div> : null}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{fmt(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────── */}
        {view === 'settings' && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
              <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">← Voltar</button>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold">📬 Notificações</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Email que recebe notificações</label>
                  <Input value={settings.notification_email} onChange={e => setSettings(s => ({ ...s, notification_email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">WhatsApp para notificações</label>
                  <Input value={settings.notification_whatsapp} onChange={e => setSettings(s => ({ ...s, notification_whatsapp: e.target.value }))} placeholder="+55 47 99999-9999" />
                  <p className="text-xs text-muted-foreground mt-1">Em breve — integração com WhatsApp API</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold">⏱ Prazos automáticos</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Validade padrão do link (dias)</label>
                  <Input type="number" value={settings.briefing_expiry_days} onChange={e => setSettings(s => ({ ...s, briefing_expiry_days: e.target.value }))} className="w-28" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Lembrete automático após X dias sem resposta</label>
                  <Input type="number" value={settings.reminder_days} onChange={e => setSettings(s => ({ ...s, reminder_days: e.target.value }))} className="w-28" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Janela de edição pelo cliente (horas)</label>
                  <Input type="number" value={settings.editing_hours} onChange={e => setSettings(s => ({ ...s, editing_hours: e.target.value }))} className="w-28" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="text-sm font-semibold">🔒 Segurança</div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Nova senha de acesso</label>
                <Input type="password" value={settings.admin_password} onChange={e => setSettings(s => ({ ...s, admin_password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full h-11">
              {savingSettings ? 'Salvando...' : settingsSaved ? '✓ Salvo!' : 'Salvar configurações'}
            </Button>
          </div>
        )}

        {/* ── BRIEFINGS LIST ────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              {([
                { label: 'Total',       value: briefings.length,                                            status: '' },
                { label: 'Enviado',     value: briefings.filter(b => b.status === 'enviado').length,        status: 'enviado' },
                { label: 'Visualizado', value: briefings.filter(b => b.status === 'visualizado').length,    status: 'visualizado' },
                { label: 'Andamento',   value: briefings.filter(b => b.status === 'em_andamento').length,   status: 'em_andamento' },
                { label: 'Concluído',   value: briefings.filter(b => b.status === 'concluido').length,      status: 'concluido' },
              ] as { label: string; value: number; status: string }[]).map(s => (
                <button key={s.label} onClick={() => setStatusFilter(prev => prev === s.status ? '' : s.status)}
                  className={`rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${statusFilter === s.status ? 'border-primary/50 bg-primary/8' : 'border-border bg-card hover:border-border/60'}`}>
                  <div className={`text-2xl font-extrabold tabular-nums leading-tight ${statusFilter === s.status ? 'text-primary' : 'text-foreground'}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Search + Filters */}
            <div className="flex gap-2 items-center mb-3 flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">🔍</span>
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente, empresa ou tipo..."
                  className="pl-9" />
              </div>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-auto text-xs [color-scheme:dark]" />
              <span className="text-muted-foreground text-sm">→</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-auto text-xs [color-scheme:dark]" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="icon-sm" onClick={() => { setDateFrom(''); setDateTo('') }}>×</Button>
              )}
            </div>

            {/* Select all + bulk actions */}
            {filtered.length > 1 && (
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={checked => setSelectedIds(checked ? new Set(filtered.map(b => b.id)) : new Set())}
                  />
                  <span className="text-xs text-muted-foreground">Selecionar todos ({filtered.length})</span>
                </label>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 ml-auto animate-in fade-in-0 duration-150">
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteConfirm(true)}>
                      🗑️ Excluir {selectedIds.size}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
                  </div>
                )}
              </div>
            )}

            {/* List */}
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-muted shrink-0" />
                      <div className="h-4 bg-muted rounded flex-1 max-w-[160px]" />
                      <div className="flex gap-2 ml-auto">
                        <div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-16 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 ml-7">
                      <div className="h-5 w-20 bg-muted rounded-full" />
                      <div className="h-5 w-24 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="text-5xl mb-4">📋</div>
                <div className="font-semibold text-foreground mb-1">
                  {search || dateFrom || dateTo ? 'Nenhum resultado' : 'Nenhum briefing ainda'}
                </div>
                <div className="text-sm mb-5">
                  {search || dateFrom || dateTo ? 'Tente ajustar os filtros' : 'Crie o primeiro briefing para começar'}
                </div>
                {!search && !dateFrom && !dateTo && (
                  <Button onClick={() => router.push('/admin/novo')}>+ Criar briefing</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(b => (
                  <div key={b.id}
                    className={`rounded-xl border px-4 py-3.5 transition-all duration-150 group ${selectedIds.has(b.id) ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card hover:border-border/80'}`}>

                    {/* Row 1: checkbox + name + action buttons */}
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={selectedIds.has(b.id)}
                        onCheckedChange={() => toggleSelect(b.id)}
                        className="shrink-0"
                      />
                      <button onClick={() => viewClientHistory(b.clients)}
                        className="font-semibold text-[15px] text-left flex-1 min-w-0 truncate hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0">
                        {b.clients?.company}
                      </button>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)} title="Editar cliente">✏️</Button>
                        <Button variant="ghost" size="icon-sm"
                          className={b.internal_notes ? 'text-primary' : ''}
                          onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }} title="Anotações internas">📝</Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => viewNotifications(b)} title="Histórico de envios">📬</Button>
                        <Button variant="ghost" size="icon-sm" disabled={duplicating === b.id} onClick={() => duplicateBriefing(b)} title="Duplicar">
                          {duplicating === b.id ? '⏳' : '⿻'}
                        </Button>
                        {b.status !== 'concluido' && b.clients?.email && (
                          <Button variant="ghost" size="sm"
                            className={reminderSent === b.id + '_resend' ? 'text-primary' : ''}
                            disabled={sendingResend === b.id} onClick={() => resendEmail(b)}>
                            {sendingResend === b.id ? '...' : reminderSent === b.id + '_resend' ? '✓ Reenviado' : '📧 Reenviar'}
                          </Button>
                        )}
                        {b.status !== 'concluido' && (
                          <Button variant="ghost" size="icon-sm"
                            className={reminderSent === b.id ? 'text-primary' : ''}
                            disabled={sendingReminder === b.id} onClick={() => sendReminder(b)} title="Enviar lembrete">
                            {sendingReminder === b.id ? '...' : reminderSent === b.id ? '✓' : '🔔'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => copyLink(b.slug)}>
                          {copiedId === b.slug ? '✓ Copiado' : '🔗 Link'}
                        </Button>
                        {b.status === 'concluido' && (
                          <>
                            <Button variant="accent" size="sm" onClick={() => viewResponses(b)}>Ver respostas</Button>
                            <Button variant="ghost" size="icon-sm"
                              title={b.editing_locked ? 'Liberar edição' : 'Bloquear edição'}
                              onClick={() => toggleEditingLock(b.slug, !!b.editing_locked)}>
                              {b.editing_locked ? '🔓' : '🔒'}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteBriefing(b)} title="Excluir">🗑️</Button>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2.5 ml-[26px] flex-wrap">
                      <StatusBadge status={b.status} />
                      <Badge variant="outline" className="text-[11px] font-medium">{b.type_label}</Badge>
                      {b.language === 'en-US' && <span className="text-xs" title="Briefing em inglês">🇺🇸</span>}
                      {(b.update_count || 0) > 0 && (
                        <button onClick={() => openDiffModal(b)} title="Ver alterações"
                          className="text-[11px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full cursor-pointer border-none hover:bg-primary/90 transition-colors">
                          ✏️ {b.update_count}x
                        </button>
                      )}
                      <span className="text-[11px] text-muted-foreground">{b.clients?.name}</span>
                      <span className="text-[11px] text-muted-foreground">· {timeAgo(b.created_at)} ({fmt(b.created_at)})</span>
                      {b.completed_at && <span className="text-[11px] text-muted-foreground">· concluído {fmt(b.completed_at)}</span>}
                      {b.expires_at && new Date(b.expires_at) > new Date() && (
                        <span className="text-[11px] text-yellow-500">· expira {fmt(b.expires_at)}</span>
                      )}
                      {b.expires_at && new Date(b.expires_at) < new Date() && (
                        <span className="text-[11px] text-destructive">· expirado</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>{/* end main content */}

      {/* ── RESPONSES MODAL ──────────────────────────────────────────── */}
      {responsesBriefing && (
        <Modal onClose={() => { setResponsesBriefing(null); setResponses(null) }} wide>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="font-extrabold text-xl tracking-tight">{responsesBriefing.clients?.company}</div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="default" className="text-[10px] uppercase tracking-wider">{responsesBriefing.type_label}</Badge>
                <span className="text-sm text-muted-foreground">{responsesBriefing.clients?.name}</span>
                {responsesBriefing.clients?.email && <span className="text-sm text-muted-foreground">· {responsesBriefing.clients.email}</span>}
              </div>
              {responsesBriefing.completed_at && (
                <div className="text-xs text-muted-foreground mt-1">Concluído em {fmt(responsesBriefing.completed_at)}</div>
              )}
            </div>
          </div>

          {/* Copy + PDF */}
          <div className="flex gap-2 mb-5">
            <Button onClick={copyAll} variant="outline" className="flex-1">{copied ? '✓ Copiado!' : '📋 Copiar tudo'}</Button>
            <Button onClick={exportPDF} variant="accent" className="flex-1">📄 Exportar PDF</Button>
          </div>

          {/* Diff toggle */}
          {responseVersions > 1 && responseDiff && (
            <div className="mb-4">
              <div className="flex gap-2">
                <button onClick={() => setShowDiffView(false)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${!showDiffView ? 'border-primary/40 bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  📋 Respostas atuais
                </button>
                <button onClick={() => setShowDiffView(true)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${showDiffView ? 'border-primary/40 bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  ✏️ Ver alterações
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{Object.keys(responseDiff).length}</span>
                </button>
              </div>
              {showDiffView && (
                <div className="mt-3 flex flex-col gap-2">
                  {Object.keys(responseDiff).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma alteração detectada</div>
                  ) : Object.entries(responseDiff).map(([key, { old: oldVal, new: newVal }]) => {
                    const labelMap = responsesBriefing?.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                    const label = labelMap[key] || key.replace(/_/g, ' ')
                    const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
                    const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
                    return (
                      <div key={key} className="rounded-lg overflow-hidden border border-primary/20">
                        <div className="px-3.5 py-2 bg-primary/5 border-b border-primary/20">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">✏️ {label}</span>
                        </div>
                        <div className="px-3.5 py-3 bg-card flex flex-col gap-2">
                          <div className="text-xs text-muted-foreground line-through leading-relaxed">
                            <span className="font-semibold not-italic mr-2 no-underline">ERA</span>{oldStr || '—'}
                          </div>
                          <div className="text-sm font-semibold text-foreground leading-relaxed">
                            <span className="text-[10px] text-primary font-bold mr-2">AGORA</span>{newStr}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Responses content */}
          {responses && !showDiffView && (
            <ResponsesContent
              responses={responses}
              language={responsesBriefing?.language}
              companyName={responsesBriefing?.clients?.company || 'briefing'}
              renderFileValue={renderFileValue}
              labelMapPT={FIELD_LABELS_PT}
              labelMapEN={FIELD_LABELS_EN}
            />
          )}
          {!responses && <div className="flex justify-center py-10"><div className="spinner" /></div>}
        </Modal>
      )}

      {/* ── DIFF MODAL ───────────────────────────────────────────────── */}
      {diffModal && (
        <Modal onClose={() => setDiffModal(null)} wide>
          <div className="font-extrabold text-xl tracking-tight mb-1">{diffModal.briefing.clients?.company}</div>
          <div className="flex items-center gap-2 mb-5">
            <Badge variant="default" className="text-[10px] font-bold">✏️ {diffModal.briefing.update_count}x atualizado</Badge>
            <span className="text-sm text-muted-foreground">{diffModal.briefing.type_label}</span>
          </div>
          {loadingDiff ? (
            <div className="flex justify-center py-10"><div className="spinner" /></div>
          ) : Object.keys(diffModal.diff).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-sm mb-4">Não foi possível comparar versões — apenas a versão mais recente está disponível.</div>
              <Button variant="accent" onClick={() => { setDiffModal(null); viewResponses(diffModal.briefing) }}>Ver respostas completas →</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-muted-foreground mb-1">
                {Object.keys(diffModal.diff).length} {Object.keys(diffModal.diff).length === 1 ? 'campo alterado' : 'campos alterados'}
              </div>
              {Object.entries(diffModal.diff).map(([key, { old: oldVal, new: newVal }]) => {
                const labelMap = diffModal.briefing.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                const label = labelMap[key] || key.replace(/_/g, ' ')
                const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
                const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
                return (
                  <div key={key} className="rounded-lg overflow-hidden border border-primary/20">
                    <div className="px-3.5 py-2 bg-primary/5 border-b border-primary/20">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">✏️ {label}</span>
                    </div>
                    <div className="px-3.5 py-3 bg-card flex flex-col gap-2">
                      <div className="text-xs text-muted-foreground line-through leading-relaxed">{oldStr || '—'}</div>
                      <div className="text-sm font-semibold text-foreground leading-relaxed">{newStr}</div>
                    </div>
                  </div>
                )
              })}
              <Button variant="ghost" onClick={() => { setDiffModal(null); viewResponses(diffModal.briefing) }} className="mt-2">
                Ver todas as respostas →
              </Button>
            </div>
          )}
        </Modal>
      )}

      {/* ── EDIT CLIENT MODAL ────────────────────────────────────────── */}
      {editBriefing && (
        <Modal onClose={() => setEditBriefing(null)}>
          <div className="mb-5">
            <div className="font-bold text-lg">Editar cliente</div>
            <div className="text-xs text-muted-foreground mt-0.5">Após salvar, copie o link e reenvie se necessário</div>
          </div>
          <div className="flex flex-col gap-4">
            {[{ label: 'Empresa', key: 'company' as const }, { label: 'Nome do contato', key: 'name' as const }, { label: 'Email', key: 'email' as const }, { label: 'WhatsApp', key: 'phone' as const }].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{f.label}</label>
                <Input value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              💡 Após salvar, use 🔗 Link para copiar e reenviar o briefing.
            </div>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" onClick={() => setEditBriefing(null)} className="flex-1">Cancelar</Button>
              <Button onClick={saveEdit} disabled={savingEdit} className="flex-[2]">{savingEdit ? 'Salvando...' : 'Salvar alterações'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NOTES MODAL ──────────────────────────────────────────────── */}
      {notesBriefing && (
        <Modal onClose={() => setNotesBriefing(null)}>
          <div className="font-bold text-lg mb-1">Anotações internas</div>
          <div className="text-xs text-muted-foreground mb-4">Visível só para você — o cliente não vê</div>
          <textarea value={notesText} onChange={e => setNotesText(e.target.value)}
            placeholder="Anote qualquer informação sobre o cliente ou projeto..."
            className="w-full min-h-[140px] bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring mb-4" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setNotesBriefing(null)} className="flex-1">Cancelar</Button>
            <Button onClick={saveNotes} disabled={savingNotes} className="flex-[2]">{savingNotes ? 'Salvando...' : 'Salvar anotação'}</Button>
          </div>
        </Modal>
      )}

      {/* ── NOTIFICATIONS MODAL ──────────────────────────────────────── */}
      {notifBriefing && (
        <Modal onClose={() => { setNotifBriefing(null); setNotifHistory([]) }}>
          <div className="font-bold text-lg mb-0.5">Histórico de envios</div>
          <div className="text-xs text-muted-foreground mb-4">{notifBriefing.clients?.company} · {notifBriefing.type_label}</div>
          {notifBriefing.clients?.email && (
            <div className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm mb-4">
              📧 Email: <span className="font-semibold text-foreground">{notifBriefing.clients.email}</span>
            </div>
          )}
          {notifHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum envio registrado</div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifHistory.map((n, i) => {
                const typeLabels: Record<string, string> = { email_client: '📧 Email pro cliente', email_admin: '📧 Email pro admin', reminder: '🔔 Lembrete', resend: '📧 Reenvio' }
                return (
                  <div key={i} className="rounded-lg border border-border bg-secondary px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{typeLabels[n.type] || n.type}</span>
                      <span className={`text-xs font-semibold ${n.status === 'sent' ? 'text-primary' : 'text-destructive'}`}>
                        {n.status === 'sent' ? '✓ Enviado' : '✗ Falhou'}
                      </span>
                    </div>
                    {n.details?.to && <div className="text-xs text-muted-foreground mt-1">Para: {n.details.to}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(n.sent_at).toLocaleString('pt-BR')}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {/* ── DELETE CONFIRM ────────────────────────────────────────────── */}
      {deleteBriefing && (
        <Modal onClose={() => setDeleteBriefing(null)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <div className="font-bold text-lg mb-1">Excluir briefing?</div>
            <div className="text-sm text-muted-foreground mb-1">
              <span className="font-semibold text-foreground">{deleteBriefing.clients?.company}</span> — {deleteBriefing.type_label}
            </div>
            <div className="text-xs text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteBriefing(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── BATCH DELETE CONFIRM ─────────────────────────────────────── */}
      {batchDeleteConfirm && (
        <Modal onClose={() => setBatchDeleteConfirm(false)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <div className="font-bold text-lg mb-1">Excluir {selectedIds.size} briefings?</div>
            <div className="text-xs text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBatchDeleteConfirm(false)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={batchDeleting} className="flex-1">
                {batchDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── CLIENT HISTORY MODAL ─────────────────────────────────────── */}
      {clientHistoryClient && (
        <Modal onClose={() => setClientHistoryClient(null)} wide>
          <div className="font-bold text-lg mb-0.5">{clientHistoryClient.company}</div>
          <div className="text-xs text-muted-foreground mb-4">{clientHistoryClient.name} · {clientHistoryClient.email}</div>
          <div className="flex flex-col gap-2">
            {briefings.filter(b => b.clients?.company === clientHistoryClient.company).map(b => (
              <div key={b.id} className="rounded-lg border border-border bg-secondary px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{b.type_label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(b.created_at)} · {fmt(b.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={b.status} />
                  {b.status === 'concluido' && (
                    <Button variant="accent" size="sm" onClick={() => { setClientHistoryClient(null); viewResponses(b) }}>
                      Ver respostas
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

    </div>
  )
}
