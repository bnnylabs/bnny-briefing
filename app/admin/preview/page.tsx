'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { getTemplate, BriefingType, BriefingLanguage } from '@/lib/briefing-types'

function PreviewContent() {
  const params = useSearchParams()
  const type = (params.get('type') || 'logo') as BriefingType
  const lang = (params.get('lang') || 'pt-BR') as BriefingLanguage
  const company = params.get('company') || 'Empresa'
  const template = getTemplate(type, lang)
  const isEN = lang === 'en-US'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', fontWeight: 600 }}>
            👁 Preview — não é o briefing real
          </span>
          <button onClick={() => window.close()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Fechar
          </button>
        </div>
      </header>
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--accent)', width: '14%' }} />
      </div>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 120px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{template.label}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 10 }}>
            {isEN ? template.label + ' Briefing' : 'Briefing de ' + template.label}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
            {isEN
              ? <span>Hello! We prepared this form for <strong style={{ color: 'var(--text)' }}>{company}</strong>. Some fields are pre-filled.</span>
              : <span>Olá! Preparamos este formulário para <strong style={{ color: 'var(--text)' }}>{company}</strong>. Alguns campos já foram preenchidos.</span>
            }
          </p>
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(200,255,0,0.06)', border: '1px solid var(--accent-border)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)' }}>
            {isEN
              ? <span>✦ Fields in <span style={{ background: 'rgba(200,255,0,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>green</span> were pre-filled automatically.</span>
              : <span>✦ Campos em <span style={{ background: 'rgba(200,255,0,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>verde</span> foram preenchidos automaticamente.</span>
            }
          </div>
        </div>

        {template.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {isEN ? 'Section ' + (si+1) + ' of ' + template.sections.length : 'Seção ' + (si+1) + ' de ' + template.sections.length}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 22, letterSpacing: '-0.01em', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              {section.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {section.fields.map(field => (
                <div key={field.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {field.label}{field.required && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
                    </label>
                  </div>
                  {field.hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{field.hint}</div>}
                  {field.type === 'radio' && field.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {field.options.map(opt => (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-3)', minHeight: 48 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', flexShrink: 0 }} />
                          <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {field.type === 'multiselect' && field.options && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {field.options.map(opt => (
                        <div key={opt} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 14, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-2)' }}>{opt}</div>
                      ))}
                    </div>
                  )}
                  {field.type === 'textarea' && (
                    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', minHeight: 80, color: 'var(--text-3)', fontSize: 14, lineHeight: 1.6 }}>
                      {field.placeholder || ''}
                    </div>
                  )}
                  {field.type === 'text' && (
                    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', height: 48, color: 'var(--text-3)', fontSize: 14 }}>
                      {field.placeholder || ''}
                    </div>
                  )}
                  {field.type === 'file' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 16px', border: '2px dashed var(--border-2)', borderRadius: 12, background: 'var(--bg-3)', minHeight: 80 }}>
                      <div style={{ fontSize: 24 }}>📎</div>
                      <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{isEN ? 'Tap to attach files' : 'Toque para anexar arquivos'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Imagens, PDFs · máx. 10MB</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', textAlign: 'center', fontSize: 15, fontWeight: 500 }}>
            {isEN ? '← Back' : '← Anterior'}
          </div>
          <div style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#000', textAlign: 'center', fontSize: 15, fontWeight: 700, opacity: 0.6 }}>
            {isEN ? 'Next →' : 'Próximo →'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>}>
      <PreviewContent />
    </Suspense>
  )
}
