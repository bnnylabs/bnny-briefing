import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}

const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

function baseTemplate(content: string, lang = 'pt-BR') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; color: #111; }
  .wrapper { max-width: 580px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
  .header { background: #0a0a0a; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; }
  .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.04em; color: #fff; }
  .logo span { color: #c8ff00; }
  .body { padding: 36px; }
  .footer { background: #f8f8f8; padding: 20px 36px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; }
  .btn { display: inline-block; background: #c8ff00; color: #000; font-weight: 700; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; margin-top: 24px; }
  .highlight { background: #f8f8f8; border-left: 3px solid #c8ff00; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 12px; }
  p { font-size: 15px; line-height: 1.7; color: #444; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo"><span>Bnny</span> Labs</div>
    <div style="font-size:11px;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Briefings</div>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    Bnny Labs · briefing.bnnylabs.com<br>
    ${lang === 'en-US' ? 'This is an automated email, please do not reply directly.' : 'Este é um email automático, não responda diretamente.'}
  </div>
</div>
</body>
</html>`
}

// ─── Email to client — briefing created ──────────────────────────────────────
export async function sendBriefingToClient({
  clientName, clientEmail, company, typeLabel, link, language = 'pt-BR',
}: {
  clientName: string; clientEmail: string; company: string
  typeLabel: string; link: string; language?: string
}) {
  const isEN = language === 'en-US'
  try {
    const html = baseTemplate(isEN ? `
      <h1>Your briefing is ready! 🎉</h1>
      <p>Hello, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">The <strong>Bnny Labs</strong> team has prepared a personalized <strong>${typeLabel}</strong> briefing for <strong>${company}</strong>.</p>
      <div class="highlight">
        Some fields have already been pre-filled automatically based on your information. You can review, edit and complete the rest.
      </div>
      <p>The process is simple and takes just a few minutes. Click the button below to get started:</p>
      <a href="${link}" class="btn">Fill out briefing →</a>
      <p style="margin-top:24px;font-size:13px;color:#999">If the button doesn't work, access: <a href="${link}" style="color:#000">${link}</a></p>
    ` : `
      <h1>Seu briefing está pronto! 🎉</h1>
      <p>Olá, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">A equipe da <strong>Bnny Labs</strong> preparou um briefing personalizado de <strong>${typeLabel}</strong> para a <strong>${company}</strong>.</p>
      <div class="highlight">
        Alguns campos já foram preenchidos automaticamente com base nas informações que nos passou. Você pode revisar, editar e completar o que faltar.
      </div>
      <p>O processo é simples e leva poucos minutos. Clique no botão abaixo para começar:</p>
      <a href="${link}" class="btn">Preencher briefing →</a>
      <p style="margin-top:24px;font-size:13px;color:#999">Se o botão não funcionar, acesse: <a href="${link}" style="color:#000">${link}</a></p>
    `, language)
    const result = await getResend().emails.send({
      from: FROM, to: clientEmail,
      subject: isEN ? `${typeLabel} Briefing — ${company}` : `Briefing de ${typeLabel} — ${company}`,
      html,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('Email to client failed:', error)
    return { ok: false, error }
  }
}

// ─── Email to admin — briefing completed ─────────────────────────────────────
export async function sendCompletionToAdmin({
  adminEmail, clientName, company, typeLabel, slug, baseUrl, customSubject, customBody,
}: {
  adminEmail: string; clientName: string; company: string
  typeLabel: string; slug: string; baseUrl: string
  customSubject?: string; customBody?: string
}) {
  try {
    const bodyContent = customBody || `
      <h1>Briefing concluído! ✅</h1>
      <p>O cliente <strong>${clientName}</strong> da <strong>${company}</strong> acabou de concluir o briefing de <strong>${typeLabel}</strong>.</p>
      <div class="highlight">
        <strong>Cliente:</strong> ${clientName}<br>
        <strong>Empresa:</strong> ${company}<br>
        <strong>Tipo:</strong> ${typeLabel}<br>
        <strong>Concluído em:</strong> ${new Date().toLocaleString('pt-BR')}
      </div>
      <p>Acesse o painel para ver as respostas completas:</p>
      <a href="${baseUrl}/admin" class="btn">Ver respostas no painel →</a>
    `
    const html = baseTemplate(bodyContent)
    const result = await getResend().emails.send({
      from: FROM, to: adminEmail,
      subject: customSubject || `✅ Briefing concluído — ${company} (${typeLabel})`,
      html,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('Email to admin failed:', error)
    return { ok: false, error }
  }
}

// ─── Reminder email to client ─────────────────────────────────────────────────
export async function sendReminderToClient({
  clientName, clientEmail, company, typeLabel, link, language = 'pt-BR',
}: {
  clientName: string; clientEmail: string; company: string
  typeLabel: string; link: string; language?: string
}) {
  const isEN = language === 'en-US'
  try {
    const html = baseTemplate(isEN ? `
      <h1>Reminder: your briefing is waiting ⏳</h1>
      <p>Hello, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">Just a reminder that your <strong>${typeLabel}</strong> briefing for <strong>${company}</strong> is still waiting to be filled out.</p>
      <div class="highlight">
        It only takes a few minutes! Some answers are already pre-filled — just review and confirm.
      </div>
      <a href="${link}" class="btn">Fill out now →</a>
      <p style="margin-top:24px;font-size:13px;color:#999">Direct link: <a href="${link}" style="color:#000">${link}</a></p>
    ` : `
      <h1>Lembrete: briefing aguardando ⏳</h1>
      <p>Olá, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">Passando para lembrar que seu briefing de <strong>${typeLabel}</strong> para a <strong>${company}</strong> ainda está aguardando ser preenchido.</p>
      <div class="highlight">
        Leva apenas alguns minutos! Algumas respostas já estão preenchidas automaticamente — é só revisar e confirmar.
      </div>
      <a href="${link}" class="btn">Preencher agora →</a>
      <p style="margin-top:24px;font-size:13px;color:#999">Link direto: <a href="${link}" style="color:#000">${link}</a></p>
    `, language)
    const result = await getResend().emails.send({
      from: FROM, to: clientEmail,
      subject: isEN
        ? `Reminder: ${typeLabel} briefing pending — ${company}`
        : `Lembrete: briefing de ${typeLabel} aguardando — ${company}`,
      html,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('Reminder email failed:', error)
    return { ok: false, error }
  }
}

// ─── Confirmation email to client after completing briefing ───────────────────
export async function sendClientConfirmation({
  clientName, clientEmail, company, typeLabel, language = 'pt-BR', briefingLink, editingHours = 48,
}: {
  clientName: string; clientEmail: string; company: string
  typeLabel: string; language?: string; briefingLink?: string; editingHours?: number
}) {
  const isEN = language === 'en-US'
  const editSection = briefingLink ? (isEN ? `
    <div class="highlight" style="border-left-color:#c8ff00">
      <strong style="color:#111">⏱ You have ${editingHours} hours to review your answers</strong><br>
      <span style="font-size:13px;color:#555">If you want to change anything, access the link below during this period.</span><br>
      <a href="${briefingLink}" style="display:inline-block;margin-top:12px;background:#c8ff00;color:#000;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">✏️ Review / Edit my answers →</a>
    </div>
  ` : `
    <div class="highlight" style="border-left-color:#c8ff00">
      <strong style="color:#111">⏱ Você tem ${editingHours} horas para revisar suas respostas</strong><br>
      <span style="font-size:13px;color:#555">Se quiser alterar algo, acesse o link abaixo durante este período.</span><br>
      <a href="${briefingLink}" style="display:inline-block;margin-top:12px;background:#c8ff00;color:#000;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">✏️ Revisar / Editar minhas respostas →</a>
    </div>
  `) : ''

  try {
    const html = baseTemplate(isEN ? `
      <h1>Briefing received successfully! ✅</h1>
      <p>Hello, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">We received the <strong>${typeLabel}</strong> briefing for <strong>${company}</strong>. Thank you so much for your time!</p>
      ${editSection}
      <div class="highlight">
        Our team will review your answers and will be in touch soon to move the project forward.
      </div>
      <p style="margin-top:16px;font-size:14px;color:#888">If you need anything or want to add more information, just reply to this email.</p>
    ` : `
      <h1>Briefing recebido com sucesso! ✅</h1>
      <p>Olá, <strong>${clientName}</strong>!</p>
      <p style="margin-top:12px">Recebemos o briefing de <strong>${typeLabel}</strong> da <strong>${company}</strong>. Muito obrigado pelo seu tempo!</p>
      ${editSection}
      <div class="highlight">
        Nossa equipe vai analisar suas respostas e em breve entrará em contato para dar andamento ao projeto.
      </div>
      <p style="margin-top:16px;font-size:14px;color:#888">Se precisar de qualquer coisa ou quiser adicionar alguma informação, basta responder este email.</p>
    `, language)
    const result = await getResend().emails.send({
      from: FROM, to: clientEmail,
      replyTo: process.env.NOTIFICATION_EMAIL || FROM,
      subject: isEN ? `Briefing received — ${company}` : `Briefing recebido — ${company}`,
      html,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('Client confirmation email failed:', error)
    return { ok: false, error }
  }
}

// ─── WhatsApp via CallMeBot ───────────────────────────────────────────────────
export async function sendWhatsApp(message: string) {
  const phone = process.env.CALLMEBOT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY
  if (!phone || !apikey) return { ok: false, reason: 'not configured' }
  try {
    const encoded = encodeURIComponent(message)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
    const res = await fetch(url)
    return { ok: res.ok }
  } catch (error) {
    console.error('WhatsApp failed:', error)
    return { ok: false, error }
  }
}
