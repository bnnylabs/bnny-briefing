'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Info,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useToast, ToastContainer } from '@/components/toast'
import { fullVersion, APP_VERSION } from '@/lib/version'
import { Logo } from '@/components/brand/Logo'
import { EmailsTab } from './EmailsTab'

type SettingsBag = {
  // Geral
  notification_email: string
  notification_whatsapp: string
  // Briefings
  briefing_expiry_days: string
  reminder_days: string
  editing_hours: string
  default_language: string
  // Conta
  admin_password: string
  // Marca
  brand_name: string
  brand_logo_url: string
  brand_logo_email: string
  brand_primary_color: string
  brand_email_from_name: string
  brand_email_signature: string
}

const EMPTY: SettingsBag = {
  notification_email: '',
  notification_whatsapp: '',
  briefing_expiry_days: '30',
  reminder_days: '3',
  editing_hours: '48',
  default_language: 'pt-BR',
  admin_password: '',
  brand_name: '',
  brand_logo_url: '',
  brand_logo_email: '',
  brand_primary_color: '',
  brand_email_from_name: '',
  brand_email_signature: '',
}

type ProfileBag = {
  name: string
  photo_url: string
  job_title: string
}

const EMPTY_PROFILE: ProfileBag = {
  name: '',
  photo_url: '',
  job_title: 'Admin',
}

function getInitials(name: string): string {
  if (!name) return 'BL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ConfigPage() {
  const router = useRouter()
  const { toasts, toast, remove } = useToast()
  const [settings, setSettings] = React.useState<SettingsBag>(EMPTY)
  const [profile, setProfile] = React.useState<ProfileBag>(EMPTY_PROFILE)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<number>(0)
  const [activeTab, setActiveTab] = React.useState('geral')

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/profile'),
      ])
      if (sRes.status === 401 || pRes.status === 401) {
        router.push('/admin')
        return
      }
      if (sRes.ok) {
        const d = await sRes.json()
        if (!cancelled) setSettings((s) => ({ ...s, ...d.settings }))
      }
      if (pRes.ok) {
        const d = await pRes.json()
        if (!cancelled && d.profile) {
          setProfile({
            name: d.profile.name || '',
            photo_url: d.profile.photo_url || '',
            job_title: d.profile.job_title || 'Admin',
          })
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  function update<K extends keyof SettingsBag>(key: K, value: SettingsBag[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  async function save() {
    setSaving(true)
    // Don't send empty password — that would clear it
    const payload: Record<string, string> = { ...settings }
    if (!payload.admin_password) delete payload.admin_password

    const [sRes, pRes] = await Promise.all([
      fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          job_title: profile.job_title,
          // photo_url is updated by the upload endpoint directly
        }),
      }),
    ])
    setSaving(false)
    if (sRes.ok && pRes.ok) {
      setSavedAt(Date.now())
      toast('Configurações salvas', 'success', 2000)
      setSettings((s) => ({ ...s, admin_password: '' }))
    } else {
      toast('Erro ao salvar', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center gap-2">
          <IconButton
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Voltar"
            size="icon"
            onClick={() => router.push('/admin')}
          />
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">
              Configurações
            </h1>
            <p className="text-xs text-muted-foreground">
              Personalize o sistema sem precisar mexer no código
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex w-full overflow-x-auto sm:grid sm:grid-cols-6">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="briefings">Briefings</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="marca">Marca</TabsTrigger>
            <TabsTrigger value="sobre">Sobre</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral" className="space-y-4">
            <SectionCard
              icon={<Mail size={14} />}
              title="Notificações"
              description="Para onde mandamos avisos quando algo acontece no painel"
            >
              <Field
                label="Email para notificações"
                value={settings.notification_email}
                onChange={(v) => update('notification_email', v)}
                placeholder="seu@email.com"
              />
              <Field
                label="WhatsApp"
                value={settings.notification_whatsapp}
                onChange={(v) => update('notification_whatsapp', v)}
                placeholder="+55 47 99999-9999"
                hint="Em breve — integração com WhatsApp API"
              />
            </SectionCard>
          </TabsContent>

          {/* BRIEFINGS */}
          <TabsContent value="briefings" className="space-y-4">
            <SectionCard
              icon={<Sparkles size={14} />}
              title="Comportamento padrão"
              description="Aplicado a todo briefing novo — pode ser sobrescrito caso a caso"
            >
              <Field
                label="Validade do link (dias)"
                type="number"
                value={settings.briefing_expiry_days}
                onChange={(v) => update('briefing_expiry_days', v)}
                width="narrow"
              />
              <Field
                label="Lembrete automático após X dias sem resposta"
                type="number"
                value={settings.reminder_days}
                onChange={(v) => update('reminder_days', v)}
                width="narrow"
              />
              <Field
                label="Janela de edição pelo cliente (horas)"
                type="number"
                value={settings.editing_hours}
                onChange={(v) => update('editing_hours', v)}
                width="narrow"
              />
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Idioma padrão
                </Label>
                <div className="flex gap-1.5">
                  {(['pt-BR', 'en-US'] as const).map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => update('default_language', lang)}
                      className={
                        settings.default_language === lang
                          ? 'border-foreground/20 bg-muted text-foreground hover:bg-muted/80'
                          : ''
                      }
                    >
                      {lang === 'pt-BR' ? 'PT' : 'EN'}
                    </Button>
                  ))}
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* EMAILS */}
          <TabsContent value="emails" className="space-y-4">
            <EmailsTab toast={toast} />
          </TabsContent>

          {/* PERFIL */}
          <TabsContent value="perfil" className="space-y-4">
            <SectionCard
              icon={<User size={14} />}
              title="Você"
              description="Aparece no rodapé da sidebar quando você está logado"
            >
              <ProfilePhotoField
                currentUrl={profile.photo_url}
                fallbackInitials={getInitials(profile.name)}
                onChange={(url) =>
                  setProfile((p) => ({ ...p, photo_url: url }))
                }
                onError={(msg) => toast(msg, 'error')}
                onSuccess={(msg) => toast(msg, 'success')}
              />
              <Field
                label="Nome completo"
                value={profile.name}
                onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
                placeholder="Seu nome"
              />
              <Field
                label="Cargo"
                value={profile.job_title}
                onChange={(v) => setProfile((p) => ({ ...p, job_title: v }))}
                placeholder="Admin"
                hint="Texto pequeno mostrado abaixo do seu nome"
              />
            </SectionCard>

            <SectionCard
              icon={<ShieldCheck size={14} />}
              title="Segurança"
              description="Senha de acesso ao painel admin"
            >
              <Field
                label="Nova senha de acesso"
                type="password"
                value={settings.admin_password}
                onChange={(v) => update('admin_password', v)}
                placeholder="Deixe em branco para não alterar"
                hint="Você precisará usar a nova senha no próximo login"
              />
            </SectionCard>
          </TabsContent>

          {/* MARCA */}
          <TabsContent value="marca" className="space-y-4">
            <SectionCard
              icon={<ImageIcon size={14} />}
              title="Identidade visual"
              description="Aparece na sidebar, nos emails enviados e na tela de confirmação do cliente"
            >
              <Field
                label="Nome de exibição"
                value={settings.brand_name}
                onChange={(v) => update('brand_name', v)}
                placeholder="Bnny Labs"
                hint="Padrão: Bnny Labs"
              />
              <BrandLogoField
                currentUrl={settings.brand_logo_url}
                onChange={(url) => update('brand_logo_url', url)}
                onError={(msg) => toast(msg, 'error')}
                onSuccess={(msg) => toast(msg, 'success')}
              />
              <BrandLogoField
                kind="email"
                currentUrl={settings.brand_logo_email}
                onChange={(url) => update('brand_logo_email', url)}
                onError={(msg) => toast(msg, 'error')}
                onSuccess={(msg) => toast(msg, 'success')}
              />
              <Field
                label="Cor primária (HEX)"
                value={settings.brand_primary_color}
                onChange={(v) => update('brand_primary_color', v)}
                placeholder="#a3e635"
                hint="Aplicada nos botões primários e CTAs. Padrão: #a3e635"
              />
            </SectionCard>

            <SectionCard
              icon={<Mail size={14} />}
              title="Comunicação"
              description="Como sua marca aparece nos emails enviados aos clientes"
            >
              <Field
                label="Nome do remetente"
                value={settings.brand_email_from_name}
                onChange={(v) => update('brand_email_from_name', v)}
                placeholder="Bnny Labs"
                hint="Aparece como 'De: <nome>' no email do cliente"
              />
              <Field
                label="Assinatura no rodapé do email"
                value={settings.brand_email_signature}
                onChange={(v) => update('brand_email_signature', v)}
                placeholder="Bnny Labs · briefing.bnnylabs.com"
                hint="Texto pequeno no rodapé"
              />
            </SectionCard>
          </TabsContent>

          {/* SOBRE */}
          <TabsContent value="sobre" className="space-y-4">
            <SectionCard
              icon={<Info size={14} />}
              title="Sistema"
              description="Informações da instalação atual"
            >
              <KeyValueRow label="Versão atual" value={fullVersion()} />
              <KeyValueRow label="Release" value={APP_VERSION} />
              <KeyValueRow
                label="Repositório"
                value="github.com/bnnylabs/bnny-briefing"
                href="https://github.com/bnnylabs/bnny-briefing"
              />
              <KeyValueRow
                label="Hospedagem"
                value="Vercel"
                href="https://vercel.com"
              />
              <KeyValueRow label="Banco de dados" value="Supabase" />
              <KeyValueRow label="Email transacional" value="Resend" />
            </SectionCard>

            <SectionCard
              icon={<Palette size={14} />}
              title="Stack"
              description="O que está rodando por baixo"
            >
              <KeyValueRow label="Framework" value="Next.js 16" />
              <KeyValueRow label="UI" value="shadcn/ui + Tailwind" />
              <KeyValueRow label="Tipografia" value="Inter + Geist Mono" />
            </SectionCard>
          </TabsContent>
        </Tabs>

        {/* Sticky save bar — hidden on the Emails tab (templates have their own per-item save) */}
        {activeTab !== 'emails' && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-lg border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="text-xs text-muted-foreground">
            {savedAt > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <Check size={12} />
                Salvo há instantes
              </span>
            ) : (
              'Suas alterações serão aplicadas após salvar'
            )}
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              'Salvando…'
            ) : (
              <>
                <Save size={14} />
                Salvar configurações
              </>
            )}
          </Button>
        </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* Internal building blocks                                              */
/* ──────────────────────────────────────────────────────────────────── */

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  width = 'full',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
  width?: 'full' | 'narrow'
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={width === 'narrow' ? 'w-32' : undefined}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function KeyValueRow({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="font-mono text-sm">{value}</span>
      )}
    </div>
  )
}

function BrandLogoField({
  kind = 'app',
  currentUrl,
  onChange,
  onError,
  onSuccess,
}: {
  kind?: 'app' | 'email'
  currentUrl: string
  onChange: (url: string) => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const isEmail = kind === 'email'
  const label = isEmail ? 'Logo do email' : 'Logo'
  const accept = isEmail ? 'image/png,image/jpeg' : 'image/svg+xml,image/png,image/jpeg,image/webp'
  const formatHint = isEmail
    ? 'PNG ou JPG, fundo transparente — mín 400px de largura. Recomendado 600×150px'
    : 'SVG, PNG, JPG ou WebP — máximo 2 MB'
  const fallbackHint = isEmail
    ? 'Sem logo customizado — usaremos o texto Bnny Labs nos emails'
    : 'Usando logo padrão Bnny Labs'

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/brand/upload?kind=${kind}`, {
      method: 'POST',
      body: fd,
    })
    setUploading(false)
    if (res.ok) {
      const d = await res.json()
      onChange(d.url)
      onSuccess('Logo atualizado')
    } else {
      const d = await res.json().catch(() => ({}))
      onError(d.error || 'Falha no upload')
    }
  }

  async function handleRemove() {
    setUploading(true)
    await fetch(`/api/admin/brand/upload?kind=${kind}`, { method: 'DELETE' })
    setUploading(false)
    onChange('')
    onSuccess('Logo removido — usando padrão')
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded border border-border bg-card">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt={label}
              className="max-h-full max-w-full object-contain p-1"
            />
          ) : isEmail ? (
            <span className="font-mono text-[10px] font-bold tracking-tight text-muted-foreground">
              Bnny Labs
            </span>
          ) : (
            <Logo className="h-5 w-auto text-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {currentUrl ? (
            <>
              {isEmail ? 'Logo de email em uso' : 'Logo personalizado em uso'}
              <br />
              <span className="break-all opacity-60">{currentUrl}</span>
            </>
          ) : (
            <>
              {fallbackHint}
              <br />
              {formatHint}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} />
            {uploading ? 'Enviando…' : 'Trocar'}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={13} />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfilePhotoField({
  currentUrl,
  fallbackInitials,
  onChange,
  onError,
  onSuccess,
}: {
  currentUrl: string
  fallbackInitials: string
  onChange: (url: string) => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/profile/photo', {
      method: 'POST',
      body: fd,
    })
    setUploading(false)
    if (res.ok) {
      const d = await res.json()
      onChange(d.url)
      onSuccess('Foto atualizada')
    } else {
      const d = await res.json().catch(() => ({}))
      onError(d.error || 'Falha no upload')
    }
  }

  async function handleRemove() {
    setUploading(true)
    await fetch('/api/admin/profile/photo', { method: 'DELETE' })
    setUploading(false)
    onChange('')
    onSuccess('Foto removida')
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Foto
      </Label>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt="Foto"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold text-foreground">
              {fallbackInitials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {currentUrl ? (
            'Foto personalizada em uso'
          ) : (
            <>
              Sem foto — usando suas iniciais
              <br />
              PNG, JPG ou WebP — máximo 2 MB
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} />
            {uploading ? 'Enviando…' : 'Trocar'}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={13} />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
