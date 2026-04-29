'use client'

import * as React from 'react'
import { Loader2, Save, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TEXTAREA_CLASSES =
  'block w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type ToastFn = (
  message: string,
  type?: 'success' | 'error' | 'info',
  duration?: number,
) => void

interface EstudioTabProps {
  toast: ToastFn
}

/**
 * Form fields aligned with lib/studio-identity.ts. Values are loaded
 * from GET /api/admin/studio-identity on mount and saved with PUT.
 *
 * social_links uses a fixed set of well-known networks (instagram,
 * linkedin, twitter, github) — keeps the UI simple. The DB column
 * accepts arbitrary keys, so a future iteration can add more without
 * a schema change.
 */
interface FormState {
  studio_name: string
  tagline: string
  email_contact: string
  phone_contact: string
  whatsapp_contact: string
  website: string
  address: string
  city: string
  state: string
  country: string
  cnpj: string
  footer_disclaimer: string
  voice_manifesto: string
  // Social — flat keys for the form, packed into social_links on save
  instagram: string
  linkedin: string
  twitter: string
}

const EMPTY_FORM: FormState = {
  studio_name: '',
  tagline: '',
  email_contact: '',
  phone_contact: '',
  whatsapp_contact: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: '',
  cnpj: '',
  footer_disclaimer: '',
  voice_manifesto: '',
  instagram: '',
  linkedin: '',
  twitter: '',
}

export function EstudioTab({ toast }: EstudioTabProps) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Initial load
  React.useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/admin/studio-identity', {
          cache: 'no-store',
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error('Falha ao carregar')
        const { studio } = await res.json()
        const social = studio.social_links || {}
        setForm({
          studio_name: studio.studio_name ?? '',
          tagline: studio.tagline ?? '',
          email_contact: studio.email_contact ?? '',
          phone_contact: studio.phone_contact ?? '',
          whatsapp_contact: studio.whatsapp_contact ?? '',
          website: studio.website ?? '',
          address: studio.address ?? '',
          city: studio.city ?? '',
          state: studio.state ?? '',
          country: studio.country ?? '',
          cnpj: studio.cnpj ?? '',
          footer_disclaimer: studio.footer_disclaimer ?? '',
          voice_manifesto: studio.voice_manifesto ?? '',
          instagram: social.instagram ?? '',
          linkedin: social.linkedin ?? '',
          twitter: social.twitter ?? '',
        })
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        console.error('[EstudioTab] load failed:', e)
        toast('Erro ao carregar identidade do estúdio', 'error')
      } finally {
        setLoading(false)
      }
    })()
    return () => ctrl.abort()
  }, [toast])

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.studio_name.trim()) {
      toast('Nome do estúdio é obrigatório', 'error')
      return
    }
    if (!form.email_contact.trim()) {
      toast('E-mail de contato é obrigatório', 'error')
      return
    }

    setSaving(true)
    try {
      const social_links: Record<string, string> = {}
      if (form.instagram.trim()) social_links.instagram = form.instagram.trim()
      if (form.linkedin.trim()) social_links.linkedin = form.linkedin.trim()
      if (form.twitter.trim()) social_links.twitter = form.twitter.trim()

      const payload = {
        studio_name: form.studio_name.trim(),
        tagline: form.tagline.trim() || null,
        email_contact: form.email_contact.trim(),
        phone_contact: form.phone_contact.trim() || null,
        whatsapp_contact: form.whatsapp_contact.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        cnpj: form.cnpj.trim() || null,
        footer_disclaimer: form.footer_disclaimer.trim() || null,
        voice_manifesto: form.voice_manifesto.trim() || null,
        social_links,
      }

      const res = await fetch('/api/admin/studio-identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      toast('Identidade do estúdio salva', 'success')
    } catch (e) {
      console.error('[EstudioTab] save failed:', e)
      toast(`Erro ao salvar: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Identidade do estúdio
          </h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Informações que aparecem no rodapé das propostas públicas, em
            e-mails e como contexto pra IA. Mude aqui sem precisar deploy.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>

      {/* Identidade básica */}
      <Card className="p-5">
        <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Básico
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="studio_name">Nome do estúdio *</Label>
            <Input
              id="studio_name"
              value={form.studio_name}
              onChange={(e) => update('studio_name', e.target.value)}
              placeholder="Bnny Labs"
            />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline (opcional)</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(e) => update('tagline', e.target.value)}
              placeholder="Estúdio criativo de Blumenau"
            />
          </div>
        </div>
      </Card>

      {/* Contato */}
      <Card className="p-5">
        <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Contato
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="email_contact">E-mail *</Label>
            <Input
              id="email_contact"
              type="email"
              value={form.email_contact}
              onChange={(e) => update('email_contact', e.target.value)}
              placeholder="gustavo@bnnylabs.com"
            />
          </div>
          <div>
            <Label htmlFor="website">Site</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://bnnylabs.com"
            />
          </div>
          <div>
            <Label htmlFor="phone_contact">Telefone</Label>
            <Input
              id="phone_contact"
              value={form.phone_contact}
              onChange={(e) => update('phone_contact', e.target.value)}
              placeholder="+55 47 98844 8858"
            />
          </div>
          <div>
            <Label htmlFor="whatsapp_contact">WhatsApp (só dígitos)</Label>
            <Input
              id="whatsapp_contact"
              value={form.whatsapp_contact}
              onChange={(e) => update('whatsapp_contact', e.target.value)}
              placeholder="5547988448858"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Usado pra montar o link wa.me/. Ex: 5547988448858
            </p>
          </div>
        </div>
      </Card>

      {/* Endereço & fiscal */}
      <Card className="p-5">
        <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Endereço e fiscal
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Rua Exemplo, 123"
            />
          </div>
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Blumenau"
            />
          </div>
          <div>
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
              placeholder="SC"
            />
          </div>
          <div>
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
              placeholder="Brasil"
            />
          </div>
          <div>
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={(e) => update('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>
        </div>
      </Card>

      {/* Redes sociais */}
      <Card className="p-5">
        <h3 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Redes sociais
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(e) => update('instagram', e.target.value)}
              placeholder="https://instagram.com/bnnylabs"
            />
          </div>
          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              value={form.linkedin}
              onChange={(e) => update('linkedin', e.target.value)}
              placeholder="https://linkedin.com/company/bnnylabs"
            />
          </div>
          <div>
            <Label htmlFor="twitter">X / Twitter</Label>
            <Input
              id="twitter"
              value={form.twitter}
              onChange={(e) => update('twitter', e.target.value)}
              placeholder="https://x.com/bnnylabs"
            />
          </div>
        </div>
      </Card>

      {/* Footer disclaimer */}
      <Card className="p-5">
        <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Disclaimer da proposta pública
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Texto curto que aparece no rodapé de toda proposta pública. Use pra
          esclarecer condições gerais (validade, escopo, etc). Markdown leve OK.
        </p>
        <textarea
          value={form.footer_disclaimer}
          onChange={(e) => update('footer_disclaimer', e.target.value)}
          rows={3}
          placeholder="Esta estimativa é baseada no escopo discutido. Mudanças no escopo podem afetar valor e prazo."
          className={TEXTAREA_CLASSES}
        />
      </Card>

      {/* Voice manifesto */}
      <Card className="p-5">
        <h3 className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Voz e manifesto (contexto pra IA)
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          O que torna seu estúdio diferente. Vai pro contexto da IA quando ela
          personaliza propostas. Não aparece pro cliente final — é direção
          interna pra manter consistência de voz.
        </p>
        <textarea
          value={form.voice_manifesto}
          onChange={(e) => update('voice_manifesto', e.target.value)}
          rows={5}
          placeholder="Cobramos por valor entregue, não por hora. Recusamos projetos que não entendemos. Falamos direto, sem inflar. ..."
          className={TEXTAREA_CLASSES}
        />
      </Card>

      {/* Save again at the bottom for long forms */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
