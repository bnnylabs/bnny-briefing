/**
 * email-defaults — single source of truth for the default copy of every
 * transactional email the app sends, in both languages.
 *
 * The DB table `email_templates` stores admin overrides only; if a
 * (type, language) row is missing or `enabled=false`, the runtime falls
 * back to the values exported here. This avoids duplicating the seed
 * copy between SQL and TS, and lets a fresh deploy work even before the
 * v4 migration has been applied — the table simply doesn't exist yet
 * and everything resolves to defaults.
 *
 * To add a new variable, edit TEMPLATE_VARIABLES + the relevant default
 * body, and ensure the sender in lib/email.ts passes the value in its
 * `vars` map. Block placeholders ({{name}}) are listed in
 * TEMPLATE_BLOCKS so the editor UI (Phase 5b) can warn when the admin
 * removes one that's required for that template type.
 */

export type TemplateType =
  | 'briefing_invitation'
  | 'briefing_reminder'
  | 'briefing_confirmation'
  | 'briefing_completed_admin'
  | 'briefing_updated_admin'
  | 'proposal_sent_to_client'
  | 'proposal_viewed_admin'
  | 'proposal_approved_admin'
  | 'proposal_rejected_admin'
  | 'proposal_approved_to_actor'
  | 'proposal_rejected_to_actor'

export type TemplateLanguage = 'pt-BR' | 'en-US'

export const TEMPLATE_TYPES: readonly TemplateType[] = [
  'briefing_invitation',
  'briefing_reminder',
  'briefing_confirmation',
  'briefing_completed_admin',
  'briefing_updated_admin',
  'proposal_sent_to_client',
  'proposal_viewed_admin',
  'proposal_approved_admin',
  'proposal_rejected_admin',
  'proposal_approved_to_actor',
  'proposal_rejected_to_actor',
] as const

export const TEMPLATE_LANGUAGES: readonly TemplateLanguage[] = ['pt-BR', 'en-US'] as const

/**
 * Inline `{var}` placeholders supported per template type. The editor
 * UI shows these as insertable chips. CTA href and any structural
 * blocks are handled separately and don't appear here.
 */
export const TEMPLATE_VARIABLES: Record<TemplateType, readonly string[]> = {
  briefing_invitation: ['client_name', 'company', 'type_label'],
  briefing_reminder: ['client_name', 'company', 'type_label'],
  briefing_confirmation: ['client_name', 'company', 'type_label', 'editing_hours'],
  briefing_completed_admin: ['client_name', 'company', 'type_label', 'completed_at'],
  briefing_updated_admin: ['company', 'type_label', 'changes_count'],
  proposal_sent_to_client: ['client_name', 'company', 'proposal_title', 'proposal_number', 'valid_until', 'total_amount'],
  proposal_viewed_admin: ['client_name', 'company', 'proposal_title', 'proposal_number', 'viewed_at'],
  proposal_approved_admin: ['actor_name', 'actor_email', 'company', 'proposal_title', 'proposal_number', 'approved_at'],
  proposal_rejected_admin: ['actor_name', 'actor_email', 'company', 'proposal_title', 'proposal_number', 'rejected_at', 'reason'],
  proposal_approved_to_actor: ['actor_name', 'company', 'proposal_title', 'proposal_number', 'approved_at', 'studio_name'],
  proposal_rejected_to_actor: ['actor_name', 'company', 'proposal_title', 'proposal_number', 'rejected_at', 'studio_name'],
}

/**
 * Block placeholders ({{name}}) that the renderer fills with structural
 * HTML pieces. The admin can reposition them inside the body but
 * removing them entirely will lose the structural element. The Phase 5b
 * editor will surface this with a soft warning.
 */
export const TEMPLATE_BLOCKS: Record<TemplateType, readonly string[]> = {
  briefing_invitation: ['fallback_link'],
  briefing_reminder: [],
  briefing_confirmation: ['editing_window'],
  briefing_completed_admin: ['meta_card'],
  briefing_updated_admin: ['changes'],
  proposal_sent_to_client: ['fallback_link'],
  proposal_viewed_admin: ['meta_card'],
  proposal_approved_admin: ['meta_card'],
  proposal_rejected_admin: ['meta_card'],
  proposal_approved_to_actor: ['meta_card'],
  proposal_rejected_to_actor: ['meta_card'],
}

/**
 * User-friendly labels for the editor UI. Kept here so the labels travel
 * with the type definitions — single import for consumers.
 */
export const TEMPLATE_LABELS: Record<TemplateType, { 'pt-BR': string; 'en-US': string }> = {
  briefing_invitation: {
    'pt-BR': 'Convite para o cliente',
    'en-US': 'Client invitation',
  },
  briefing_reminder: {
    'pt-BR': 'Lembrete pro cliente',
    'en-US': 'Client reminder',
  },
  briefing_confirmation: {
    'pt-BR': 'Confirmação após envio',
    'en-US': 'Submission confirmation',
  },
  briefing_completed_admin: {
    'pt-BR': 'Notificação de conclusão (admin)',
    'en-US': 'Completion notification (admin)',
  },
  briefing_updated_admin: {
    'pt-BR': 'Notificação de atualização (admin)',
    'en-US': 'Update notification (admin)',
  },
  proposal_sent_to_client: {
    'pt-BR': 'Envio de proposta (cliente)',
    'en-US': 'Proposal sent (client)',
  },
  proposal_viewed_admin: {
    'pt-BR': 'Cliente abriu a proposta (admin)',
    'en-US': 'Client opened proposal (admin)',
  },
  proposal_approved_admin: {
    'pt-BR': 'Cliente aprovou a proposta (admin)',
    'en-US': 'Client approved proposal (admin)',
  },
  proposal_rejected_admin: {
    'pt-BR': 'Cliente recusou a proposta (admin)',
    'en-US': 'Client rejected proposal (admin)',
  },
  proposal_approved_to_actor: {
    'pt-BR': 'Confirmação de aprovação (cliente)',
    'en-US': 'Approval confirmation (client)',
  },
  proposal_rejected_to_actor: {
    'pt-BR': 'Confirmação de recusa (cliente)',
    'en-US': 'Rejection confirmation (client)',
  },
}

export interface EmailTemplateContent {
  subject: string
  preheader: string
  title: string
  body_markdown: string
  cta_text: string
}

/** Returns true if the type's templates ever render a CTA button. */
export function templateHasCta(type: TemplateType): boolean {
  return type !== 'briefing_confirmation'
  // Confirmation only renders a CTA when an editing window link is
  // available, which is decided per-call. The cta_text column is still
  // editable for admins who want to set the label, but it's allowed to
  // be left empty.
}

// ─── Defaults ────────────────────────────────────────────────────────────
//
// These mirror the copy that lib/email.ts shipped with in v0.4.x, with
// structural HTML pieces (meta cards, fallback links, etc.) extracted
// out into block placeholders ({{block}}). Editing should preserve the
// core meaning; the layout and CTA wiring is handled by the renderer.

export const EMAIL_DEFAULTS: Record<TemplateType, Record<TemplateLanguage, EmailTemplateContent>> = {
  briefing_invitation: {
    'pt-BR': {
      subject: 'Briefing de {type_label} — {company}',
      preheader: 'Briefing personalizado para {company}',
      title: 'Seu briefing está pronto',
      body_markdown: `Olá, **{client_name}**!

Preparamos um briefing de **{type_label}** para a **{company}**.

Alguns campos já estão preenchidos com base no que sabemos. É só revisar, completar o que faltar e enviar. Leva poucos minutos.

{{fallback_link}}`,
      cta_text: 'Preencher briefing →',
    },
    'en-US': {
      subject: '{type_label} briefing — {company}',
      preheader: 'Personalized briefing for {company}',
      title: 'Your briefing is ready',
      body_markdown: `Hello, **{client_name}**!

We've prepared a **{type_label}** briefing for **{company}**.

Some fields are pre-filled based on what we know — just review, complete the rest, and submit. Takes a few minutes.

{{fallback_link}}`,
      cta_text: 'Fill out briefing →',
    },
  },
  briefing_reminder: {
    'pt-BR': {
      subject: 'Lembrete: briefing de {type_label} aguardando — {company}',
      preheader: 'Lembrete rápido — briefing pendente da {company}',
      title: 'Lembrete: briefing aguardando',
      body_markdown: `Olá, **{client_name}**!

Passando para lembrar que seu briefing de **{type_label}** da **{company}** ainda está aguardando.

Leva apenas alguns minutos — algumas respostas já estão preenchidas, é só revisar e confirmar.`,
      cta_text: 'Preencher agora →',
    },
    'en-US': {
      subject: 'Reminder: {type_label} briefing pending — {company}',
      preheader: 'Quick reminder — briefing pending for {company}',
      title: 'Reminder: your briefing is waiting',
      body_markdown: `Hello, **{client_name}**!

Just a quick reminder that your **{type_label}** briefing for **{company}** is still waiting.

It only takes a few minutes — some answers are already pre-filled, you just need to review and confirm.`,
      cta_text: 'Fill out now →',
    },
  },
  briefing_confirmation: {
    'pt-BR': {
      subject: 'Briefing recebido — {company}',
      preheader: 'Briefing recebido — {company}',
      title: 'Briefing recebido',
      body_markdown: `Olá, **{client_name}**!

Recebemos o briefing de **{type_label}** da **{company}**. Obrigado pelo seu tempo.

{{editing_window}}

Nossa equipe vai analisar suas respostas e em breve entrará em contato para dar andamento.

> Se precisar adicionar algo, é só responder esse email.`,
      cta_text: 'Revisar minhas respostas →',
    },
    'en-US': {
      subject: 'Briefing received — {company}',
      preheader: 'Briefing received — {company}',
      title: 'Briefing received',
      body_markdown: `Hello, **{client_name}**!

We received the **{type_label}** briefing for **{company}**. Thank you for taking the time.

{{editing_window}}

Our team will review your answers and reach out shortly to move things forward.

> If you need to add anything else, just reply to this email.`,
      cta_text: 'Review my answers →',
    },
  },
  briefing_completed_admin: {
    'pt-BR': {
      subject: 'Briefing concluído — {company} ({type_label})',
      preheader: 'Novas respostas para revisar',
      title: 'Briefing concluído',
      body_markdown: `**{client_name}** da **{company}** acabou de concluir o briefing de **{type_label}**.

{{meta_card}}`,
      cta_text: 'Ver no painel →',
    },
    'en-US': {
      subject: 'Briefing completed — {company} ({type_label})',
      preheader: 'New responses to review',
      title: 'Briefing completed',
      body_markdown: `**{client_name}** from **{company}** just completed the **{type_label}** briefing.

{{meta_card}}`,
      cta_text: 'View in admin →',
    },
  },
  briefing_updated_admin: {
    'pt-BR': {
      subject: '{company} atualizou o briefing de {type_label}',
      preheader: '{changes_count} alterações',
      title: 'Briefing atualizado',
      body_markdown: `**{company}** acabou de atualizar o briefing de **{type_label}**.

{{changes}}`,
      cta_text: 'Ver no painel →',
    },
    'en-US': {
      subject: '{company} updated their {type_label} briefing',
      preheader: '{changes_count} changes',
      title: 'Briefing updated',
      body_markdown: `**{company}** just updated the **{type_label}** briefing.

{{changes}}`,
      cta_text: 'View in admin →',
    },
  },
  proposal_sent_to_client: {
    'pt-BR': {
      subject: 'Orçamento {proposal_number} — {proposal_title}',
      preheader: 'Orçamento preparado pela Bnny Labs',
      title: 'Seu orçamento está pronto',
      body_markdown: `Olá, **{client_name}**!

Foi um prazer conversar com você sobre a **{company}**. Preparei o orçamento {proposal_number} com o escopo, cronograma e investimento alinhados ao que conversamos.

O documento detalha cada fase do projeto e as opções de pagamento. Esta estimativa é válida até **{valid_until}** e pode variar com mudanças no escopo.

Qualquer dúvida, é só responder este e-mail.

{{fallback_link}}`,
      cta_text: 'Ver orçamento →',
    },
    'en-US': {
      subject: 'Proposal {proposal_number} — {proposal_title}',
      preheader: 'Proposal prepared by Bnny Labs',
      title: 'Your proposal is ready',
      body_markdown: `Hello, **{client_name}**!

It was a pleasure talking to you about **{company}**. I've prepared proposal {proposal_number} with the scope, timeline, and investment aligned to what we discussed.

The document details each project phase and payment options. This estimate is valid through **{valid_until}** and may vary with scope changes.

Any questions, just reply to this email.

{{fallback_link}}`,
      cta_text: 'View proposal →',
    },
  },
  proposal_viewed_admin: {
    'pt-BR': {
      subject: '{company} abriu a proposta {proposal_number}',
      preheader: 'Cliente acabou de visualizar o orçamento',
      title: 'Cliente abriu a proposta',
      body_markdown: `**{client_name}** da **{company}** acabou de abrir o orçamento {proposal_number} — *{proposal_title}*.

{{meta_card}}`,
      cta_text: 'Ver no painel →',
    },
    'en-US': {
      subject: '{company} opened proposal {proposal_number}',
      preheader: 'Client just viewed the proposal',
      title: 'Client opened the proposal',
      body_markdown: `**{client_name}** from **{company}** just opened proposal {proposal_number} — *{proposal_title}*.

{{meta_card}}`,
      cta_text: 'View in admin →',
    },
  },
  proposal_approved_admin: {
    'pt-BR': {
      subject: '✓ {company} aprovou a proposta {proposal_number}',
      preheader: 'Cliente aprovou o orçamento — pode começar',
      title: 'Proposta aprovada',
      body_markdown: `**{actor_name}** ({actor_email}), da **{company}**, aprovou o orçamento {proposal_number} — *{proposal_title}*.

{{meta_card}}

A aprovação ficou registrada com aceite dos termos. Pode iniciar o projeto.`,
      cta_text: 'Ver no painel →',
    },
    'en-US': {
      subject: '✓ {company} approved proposal {proposal_number}',
      preheader: 'Client approved the proposal — you can start',
      title: 'Proposal approved',
      body_markdown: `**{actor_name}** ({actor_email}), from **{company}**, approved proposal {proposal_number} — *{proposal_title}*.

{{meta_card}}

The approval is on record with terms accepted. You can start the project.`,
      cta_text: 'View in admin →',
    },
  },
  proposal_rejected_admin: {
    'pt-BR': {
      subject: '✗ {company} recusou a proposta {proposal_number}',
      preheader: 'Cliente recusou o orçamento',
      title: 'Proposta recusada',
      body_markdown: `**{actor_name}** ({actor_email}), da **{company}**, recusou o orçamento {proposal_number} — *{proposal_title}*.

{{meta_card}}

{reason}`,
      cta_text: 'Ver no painel →',
    },
    'en-US': {
      subject: '✗ {company} rejected proposal {proposal_number}',
      preheader: 'Client rejected the proposal',
      title: 'Proposal rejected',
      body_markdown: `**{actor_name}** ({actor_email}), from **{company}**, rejected proposal {proposal_number} — *{proposal_title}*.

{{meta_card}}

{reason}`,
      cta_text: 'View in admin →',
    },
  },
  proposal_approved_to_actor: {
    'pt-BR': {
      subject: 'Confirmação: você aprovou a proposta {proposal_number}',
      preheader: 'Sua aprovação foi registrada',
      title: 'Aprovação registrada',
      body_markdown: `Olá, **{actor_name}**.

Confirmamos sua aprovação do orçamento {proposal_number} — *{proposal_title}* — em nome de **{company}**.

{{meta_card}}

A {studio_name} foi notificada e vai entrar em contato em breve com os próximos passos. Guarde este e-mail como comprovante de aceite dos termos descritos na proposta.`,
      cta_text: 'Ver proposta →',
    },
    'en-US': {
      subject: 'Confirmation: you approved proposal {proposal_number}',
      preheader: 'Your approval has been recorded',
      title: 'Approval recorded',
      body_markdown: `Hello, **{actor_name}**.

We confirm your approval of proposal {proposal_number} — *{proposal_title}* — on behalf of **{company}**.

{{meta_card}}

{studio_name} has been notified and will reach out soon with next steps. Keep this email as confirmation of acceptance of the terms described in the proposal.`,
      cta_text: 'View proposal →',
    },
  },
  proposal_rejected_to_actor: {
    'pt-BR': {
      subject: 'Recebemos sua resposta sobre a proposta {proposal_number}',
      preheader: 'Sua resposta foi registrada',
      title: 'Resposta registrada',
      body_markdown: `Olá, **{actor_name}**.

Registramos sua resposta sobre o orçamento {proposal_number} — *{proposal_title}* — em nome de **{company}**.

{{meta_card}}

Obrigado pelo retorno. A {studio_name} foi notificada e pode entrar em contato pra entender melhor o que ajustar, se fizer sentido.`,
      cta_text: 'Ver proposta →',
    },
    'en-US': {
      subject: 'We received your response on proposal {proposal_number}',
      preheader: 'Your response has been recorded',
      title: 'Response recorded',
      body_markdown: `Hello, **{actor_name}**.

We recorded your response on proposal {proposal_number} — *{proposal_title}* — on behalf of **{company}**.

{{meta_card}}

Thank you for the feedback. {studio_name} has been notified and may reach out to understand what to adjust, if it makes sense.`,
      cta_text: 'View proposal →',
    },
  },
}

/**
 * Sample values used by the "send test" feature so the admin gets a
 * realistic-looking preview without exposing real client data. Keep these
 * in sync with TEMPLATE_VARIABLES — the test-send endpoint will splice
 * them into the chosen template and ship a real Resend email to the
 * configured notification address.
 */
export function getSampleVariables(language: TemplateLanguage): Record<string, string> {
  const isEN = language === 'en-US'
  return {
    client_name: isEN ? 'Demo Client' : 'Cliente Demo',
    company: isEN ? 'Test Company' : 'Empresa Teste',
    type_label: isEN ? 'Visual Identity' : 'Identidade Visual',
    editing_hours: '48',
    completed_at: new Date().toLocaleString(isEN ? 'en-US' : 'pt-BR'),
    changes_count: '3',
    proposal_title: isEN ? 'Visual Identity Proposal' : 'Proposta de Identidade Visual',
    proposal_number: '#001',
    valid_until: new Date(Date.now() + 7 * 86_400_000).toLocaleDateString(
      isEN ? 'en-US' : 'pt-BR',
    ),
    total_amount: 'R$ 3.000,00',
    viewed_at: new Date().toLocaleString(isEN ? 'en-US' : 'pt-BR'),
  }
}
