export type BriefingType = 'identidade' | 'social' | 'site' | 'logo'
export type BriefingLanguage = 'pt-BR' | 'en-US'

export interface FieldCondition {
  field: string        // id of the field to check
  values: string[]     // show only if that field's value is in this list
}

export interface BriefingField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'file'
  placeholder?: string
  options?: string[]
  required?: boolean
  hint?: string
  condition?: FieldCondition  // show only when condition is met
}

export interface BriefingTemplate {
  type: BriefingType
  label: string
  description: string
  sections: { title: string; fields: BriefingField[] }[]
}

// ─── PT-BR Label map for admin panel responses ───────────────────────────────
export const FIELD_LABELS_PT: Record<string, string> = {
  company_name: 'Nome da empresa / marca',
  slogan: 'Slogan ou tagline',
  segment: 'Segmento de atuação',
  pitch: 'Pitch — uma frase',
  time_market: 'Tempo de mercado',
  is_rebrand: 'Novo logo ou renovação?',
  rebrand_reason: 'Motivo da criação / renovação',
  current_logo_problems: 'O que não funciona no atual',
  keep_elements: 'O que deve ser mantido',
  competitors: 'Concorrentes diretos',
  style_references: 'Referências visuais — admira',
  avoid_references: 'Referências — o que NÃO quer',
  target_audience: 'Público-alvo',
  decision_maker: 'Quem toma a decisão de compra',
  audience_perception: 'Como deve ser percebido',
  brand_personality: 'Personalidade da marca',
  logo_style: 'Estilo de logo',
  color_preferences: 'Direção de cores',
  color_palette: 'Cores da marca',
  brand_feeling: 'Sentimento que deve despertar',
  brand_tone: 'Tom de voz',
  brand_feeling_full: 'Sentimento que a marca deve despertar',
  positioning: 'Posicionamento de mercado',
  price_positioning: 'Posicionamento de preço',
  use_contexts: 'Onde será usado',
  versions_needed: 'Versões necessárias',
  file_formats: 'Formatos de entrega',
  deadline: 'Prazo / data importante',
  budget: 'Faixa de investimento',
  approver: 'Quem aprova',
  revision_expectation: 'Rodadas de revisão esperadas',
  responsible_name: 'Nome do responsável',
  responsible_email: 'Email de contato',
  responsible_phone: 'WhatsApp / celular',
  filled_by: 'Preenchido por',
  visual_references_files: 'Referências visuais (arquivos)',
  existing_logo: 'Logo atual',
  existing_brand_files: 'Arquivos da marca atual',
  extra_notes: 'Observações adicionais',
  attachments: 'Anexos',
  description: 'Sobre a empresa',
  differentials: 'Diferenciais competitivos',
  unique_value_proposition: 'Proposta de valor única',
  key_features: 'Principais características / serviços',
  geographic_focus: 'Foco geográfico',
  // identity
  identity_goal: 'Objetivo da identidade',
  brand_story: 'História da marca',
  deliverables: 'Materiais necessários',
  has_logo: 'Tem logo atual?',
  manual_needed: 'Manual de marca?',
  applications: 'Aplicações prioritárias',
  // social
  networks: 'Redes sociais ativas',
  current_followers: 'Seguidores atuais',
  current_performance: 'O que funciona hoje',
  main_goal: 'Objetivo principal',
  post_frequency: 'Frequência de posts',
  content_budget: 'Budget para produção',
  content_tone: 'Tom de voz do conteúdo',
  content_types: 'Tipos de conteúdo',
  content_pillars: 'Pilares de conteúdo',
  who_produces: 'Quem produz o conteúdo',
  has_brand: 'Tem identidade visual?',
  visual_references: 'Referências visuais',
  current_profiles: 'Links dos perfis atuais',
  avoid: 'O que NÃO quer',
  brand_files: 'Arquivos da marca',
  // site
  site_type: 'Tipo de site',
  site_goal: 'Objetivo do site',
  desired_actions: 'Ações desejadas do visitante',
  cta_priority: 'Prioridade dos CTAs',
  icp: 'Cliente ideal (ICP)',
  buyer_objections: 'Objeções de compra',
  pages: 'Páginas necessárias',
  page_count: 'Número estimado de páginas',
  sitemap: 'Estrutura / sitemap',
  has_content: 'Tem textos prontos?',
  who_writes: 'Quem escreve os textos?',
  existing_site: 'Site atual (URL)',
  site_problems: 'O que não funciona no site atual',
  platform: 'Plataforma / CMS',
  integrations: 'Integrações necessárias',
  seo_needed: 'Precisa de SEO?',
  multilingual: 'Idiomas do site',
  domain: 'Domínio',
  is_redesign: 'Novo site ou redesign?',
}


// ─── English Label map for admin panel responses ─────────────────────────────
export const FIELD_LABELS_EN: Record<string, string> = {
  company_name: 'Company / brand name',
  slogan: 'Slogan or tagline',
  segment: 'Industry / field',
  pitch: 'Pitch — one sentence',
  time_market: 'Time in market',
  is_rebrand: 'New logo or renewal?',
  rebrand_reason: 'Motivation for creation / renewal',
  current_logo_problems: "What doesn't work in the current",
  keep_elements: 'What should be kept',
  competitors: 'Direct competitors',
  style_references: 'Visual references — admires',
  avoid_references: 'References — what NOT to do',
  target_audience: 'Target audience',
  decision_maker: 'Who makes the purchase decision',
  audience_perception: 'How should it be perceived',
  brand_personality: 'Brand personality',
  logo_style: 'Logo style',
  color_preferences: 'Color direction',
  color_palette: 'Brand colors',
  brand_feeling: 'Feeling it should evoke',
  brand_tone: 'Tone of voice',
  positioning: 'Market positioning',
  price_positioning: 'Price positioning',
  use_contexts: 'Where it will be used',
  versions_needed: 'Required versions',
  file_formats: 'Delivery formats',
  deadline: 'Deadline / important date',
  budget: 'Investment range',
  approver: 'Who gives final approval',
  revision_expectation: 'Expected revision rounds',
  responsible_name: 'Contact name',
  responsible_email: 'Contact email',
  responsible_phone: 'WhatsApp / phone',
  filled_by: 'Filled by',
  visual_references_files: 'Visual references (files)',
  existing_logo: 'Current logo',
  existing_brand_files: 'Current brand files',
  extra_notes: 'Additional notes',
  attachments: 'Attachments',
  description: 'About the company',
  differentials: 'Competitive differentials',
  unique_value_proposition: 'Unique value proposition',
  key_features: 'Key features / services',
  geographic_focus: 'Geographic focus',
  identity_goal: 'Identity goal',
  brand_story: 'Brand story',
  deliverables: 'Required materials',
  has_logo: 'Has current logo?',
  manual_needed: 'Brand guide needed?',
  applications: 'Priority applications',
  networks: 'Active social networks',
  current_followers: 'Current followers',
  current_performance: 'What works today',
  main_goal: 'Main goal',
  post_frequency: 'Post frequency',
  content_budget: 'Budget for ads',
  content_tone: 'Content tone of voice',
  content_types: 'Content types',
  content_pillars: 'Content pillars',
  who_produces: 'Who produces content',
  has_brand: 'Has visual identity?',
  visual_references: 'Visual references',
  current_profiles: 'Current profile links',
  avoid: 'What NOT to include',
  brand_files: 'Brand files',
  site_type: 'Type of website',
  site_goal: 'Website goal',
  desired_actions: 'Desired visitor actions',
  cta_priority: 'CTA priority',
  icp: 'Ideal customer (ICP)',
  buyer_objections: 'Purchase objections',
  pages: 'Required pages',
  page_count: 'Estimated page count',
  sitemap: 'Sitemap / structure',
  has_content: 'Has copy ready?',
  who_writes: "Who writes the copy?",
  existing_site: 'Current site (URL)',
  site_problems: "What doesn't work on current site",
  platform: 'Platform / CMS',
  integrations: 'Required integrations',
  seo_needed: 'SEO priority?',
  multilingual: 'Site languages',
  domain: 'Domain',
  is_redesign: 'New site or redesign?',
}

// ─── PORTUGUESE TEMPLATES ────────────────────────────────────────────────────

export const BRIEFING_TEMPLATES: Record<BriefingType, BriefingTemplate> = {

  logo: {
    type: 'logo',
    label: 'Criação de Logo',
    description: 'Desenvolvimento de logotipo, símbolo e variações',
    sections: [
      {
        title: '01 — Sobre a empresa e o projeto',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'slogan', label: 'Slogan ou tagline', type: 'text', placeholder: 'Deixe em branco se não tiver' },
          { id: 'segment', label: 'Segmento de atuação', type: 'text', required: true, placeholder: 'Ex: Fintech B2B, E-commerce de moda, Clínica odontológica...' },
          { id: 'pitch', label: 'Descreva a empresa em UMA frase', type: 'textarea', required: true, placeholder: 'Ex: "Somos a plataforma que conecta freelancers a empresas tech no Brasil"' },
          { id: 'time_market', label: 'Há quanto tempo está no mercado?', type: 'text', placeholder: 'Ex: 3 anos, estamos abrindo agora...' },
          { id: 'is_rebrand', label: 'Este projeto é...', type: 'radio', required: true, options: ['Criação do zero (marca nova)', 'Renovação / evolução do logo atual', 'Substituição completa do visual'] },
        ]
      },
      {
        title: '02 — Contexto da criação',
        fields: [
          { id: 'rebrand_reason', label: 'O que motivou a criação ou renovação do logo?', type: 'textarea', required: true, placeholder: 'Ex: A empresa cresceu e o logo não representa mais quem somos. Queremos passar mais profissionalismo...' },
          { id: 'current_logo_problems', label: 'O que não funciona no logo atual?', type: 'textarea', placeholder: 'Seja específico: cores, formato, tipografia, proporções, legibilidade...', condition: { field: 'is_rebrand', values: ['Renovação / evolução do logo atual', 'Substituição completa do visual atual', 'Renewal / evolution of the current logo', 'Complete visual replacement'] } },
          { id: 'keep_elements', label: 'O que deve ser mantido (se houver)?', type: 'textarea', placeholder: 'Ex: manter as cores atuais, preservar algum elemento do ícone, manter a fonte...', condition: { field: 'is_rebrand', values: ['Renovação / evolução do logo atual', 'Substituição completa do visual atual', 'Renewal / evolution of the current logo', 'Complete visual replacement'] } },
        ]
      },
      {
        title: '03 — Mercado e referências',
        fields: [
          { id: 'competitors', label: 'Quais são os principais concorrentes diretos?', type: 'textarea', required: true, placeholder: 'Liste concorrentes e, se possível, os sites/logos deles' },
          { id: 'style_references', label: 'Empresas ou logos que admira como referência visual', type: 'textarea', required: true, placeholder: 'Não precisa ser do seu setor — pode ser qualquer marca bem feita. Ex: Apple, Nubank, Stripe...' },
          { id: 'avoid_references', label: 'Referências do que definitivamente NÃO quer', type: 'textarea', placeholder: 'Logos, estilos ou marcas que representam o que você quer evitar' },
        ]
      },
      {
        title: '04 — Público-alvo',
        fields: [
          { id: 'target_audience', label: 'Quem é o cliente ideal?', type: 'textarea', required: true, hint: 'Perfil, faixa etária, comportamento, o que valoriza, dores...' },
          { id: 'audience_perception', label: 'Como o logo deve ser percebido pelo seu público?', type: 'textarea', placeholder: 'Ex: deve transmitir confiança e autoridade, não pode parecer amador, precisa comunicar tecnologia...' },
        ]
      },
      {
        title: '05 — Personalidade e direção criativa',
        fields: [
          { id: 'brand_personality', label: 'Adjetivos que definem a marca', type: 'multiselect', options: ['Moderna', 'Clássica', 'Ousada', 'Elegante', 'Divertida', 'Séria', 'Minimalista', 'Sofisticada', 'Acessível', 'Tecnológica', 'Humana', 'Sustentável', 'Luxuosa', 'Jovem', 'Tradicional', 'Inovadora', 'Institucional', 'Criativa'] },
          { id: 'logo_style', label: 'Estilo de logo preferido', type: 'multiselect', options: ['Só texto (wordmark)', 'Símbolo + texto', 'Só símbolo / ícone', 'Monograma / iniciais', 'Mascote / personagem'] },
          { id: 'color_preferences', label: 'Direção de cores', type: 'textarea', placeholder: 'Ex: tons de azul e cinza, algo vibrante, nada de vermelho, paleta escura...' },
          { id: 'brand_feeling', label: 'Que sentimento o logo deve despertar no público?', type: 'textarea', placeholder: 'Ex: confiança, modernidade, exclusividade, leveza, urgência...' },
        ]
      },
      {
        title: '06 — Aplicações',
        fields: [
          { id: 'use_contexts', label: 'Onde o logo vai ser usado principalmente?', type: 'multiselect', options: ['Site / plataforma digital', 'Instagram e redes sociais', 'WhatsApp (foto de perfil)', 'Cartão de visita', 'Papel timbrado / documentos', 'Uniforme / bordado em roupa', 'Embalagem / produto físico', 'Outdoor / banner / placa', 'Fachada de loja ou escritório', 'Apresentações e pitch deck'] },
        ]
      },
      {
        title: '07 — Prazo e aprovação',
        fields: [
          { id: 'deadline', label: 'Tem prazo ou data importante?', type: 'text', placeholder: 'Ex: 15 de agosto, lançamento em setembro, sem prazo definido...' },
          { id: 'approver', label: 'Quem dá a palavra final na aprovação?', type: 'text', placeholder: 'Nome e cargo de quem decide — ex: CEO, sócio, diretora de marketing' },
          { id: 'filled_by', label: 'Quem preencheu este briefing?', type: 'text', placeholder: 'Deixe em branco se foi você mesmo — só preencha se for outra pessoa da equipe' },
          { id: 'visual_references_files', label: 'Anexe referências visuais (logos que admira, prints, moodboard)', type: 'file', hint: 'Imagens, PDFs, prints — qualquer referência visual ajuda muito' },
          { id: 'existing_logo', label: 'Logo atual (se tiver)', type: 'file', hint: 'Qualquer arquivo que tiver — PNG, foto, PDF' },
          { id: 'extra_notes', label: 'Algo mais que queira nos contar?', type: 'textarea', placeholder: 'Contexto extra, história da empresa, inspirações, restrições...' },
        ]
      },
    ]
  },

  identidade: {
    type: 'identidade',
    label: 'Identidade Visual',
    description: 'Criação completa de identidade visual da marca',
    sections: [
      {
        title: '01 — Sobre a empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'slogan', label: 'Slogan ou tagline', type: 'text', placeholder: 'Deixe em branco se não tiver' },
          { id: 'segment', label: 'Segmento / área de atuação', type: 'text', required: true },
          { id: 'pitch', label: 'Descreva a empresa em UMA frase', type: 'textarea', required: true, placeholder: 'O pitch mais curto e preciso que você consegue fazer da sua empresa' },
          { id: 'description', label: 'Descreva em detalhes o que a empresa faz', type: 'textarea', required: true, placeholder: 'Produtos, serviços, como funciona, o que entrega ao cliente...' },
          { id: 'time_market', label: 'Há quanto tempo está no mercado?', type: 'text' },
          { id: 'is_rebrand', label: 'Este projeto é...', type: 'radio', required: true, options: ['Criação do zero (marca nova)', 'Renovação / rebrand da marca atual', 'Expansão da marca existente'] },
        ]
      },
      {
        title: '02 — Contexto do projeto',
        fields: [
          { id: 'rebrand_reason', label: 'O que motivou a criação ou renovação da identidade?', type: 'textarea', required: true, placeholder: 'Ex: A empresa cresceu, mudamos de posicionamento, vamos captar investimento, o visual está desatualizado...' },
          { id: 'keep_elements', label: 'O que deve ser mantido da marca atual (se houver)?', type: 'textarea', placeholder: 'Ex: manter as cores, preservar o logo, manter o slogan...', condition: { field: 'is_rebrand', values: ['Renovação / rebrand da marca atual', 'Expansão da marca existente'] } },
          { id: 'identity_goal', label: 'Qual o principal objetivo desta identidade?', type: 'radio', options: ['Transmitir mais profissionalismo e credibilidade', 'Diferenciar da concorrência', 'Alcançar um novo público', 'Refletir uma nova fase da empresa', 'Preparar para crescimento / expansão'] },
        ]
      },
      {
        title: '03 — Mercado e concorrência',
        fields: [
          { id: 'competitors', label: 'Quais são os principais concorrentes diretos?', type: 'textarea', required: true, placeholder: 'Liste com sites/logos se possível' },
          { id: 'positioning', label: 'Como você quer se posicionar frente aos concorrentes?', type: 'textarea', required: true, placeholder: 'Ex: ser percebido como mais premium, mais acessível, mais especialista, mais humano...' },
          { id: 'style_references', label: 'Marcas e identidades que admira (de qualquer setor)', type: 'textarea', required: true, placeholder: 'Seja específico — o que admira em cada uma? Cores, tipografia, clareza?' },
          { id: 'avoid_references', label: 'O que definitivamente NÃO quer na identidade?', type: 'textarea', placeholder: 'Estilos, cores, elementos, referências que devem ser evitados' },
        ]
      },
      {
        title: '04 — Público e posicionamento',
        fields: [
          { id: 'target_audience', label: 'Quem é o público-alvo?', type: 'textarea', required: true, hint: 'Perfil, faixa etária, comportamento, dores, o que valoriza, poder aquisitivo' },
          { id: 'unique_value_proposition', label: 'Proposta de valor — por que você e não o concorrente?', type: 'textarea', required: true, placeholder: 'O que você resolve que ninguém mais resolve, ou resolve melhor' },
        ]
      },
      {
        title: '05 — Personalidade da marca',
        fields: [
          { id: 'brand_personality', label: 'Adjetivos que definem a marca', type: 'multiselect', options: ['Moderna', 'Clássica', 'Ousada', 'Elegante', 'Divertida', 'Séria', 'Minimalista', 'Sofisticada', 'Acessível', 'Tecnológica', 'Humana', 'Sustentável', 'Luxuosa', 'Jovem', 'Tradicional', 'Inovadora', 'Institucional', 'Criativa', 'Confiável', 'Disruptiva'] },
          { id: 'brand_tone', label: 'Tom de voz da marca', type: 'radio', options: ['Formal e institucional', 'Profissional mas próximo', 'Descontraído e jovem', 'Técnico e especialista', 'Inspiracional e aspiracional'] },
          { id: 'brand_feeling', label: 'Que sentimento a marca deve despertar?', type: 'textarea', placeholder: 'Ex: confiança, inovação, exclusividade, acolhimento, urgência, segurança...' },
          { id: 'brand_story', label: 'Tem alguma história ou propósito por trás da marca que deve se refletir no visual?', type: 'textarea', placeholder: 'Ex: fundada por dois engenheiros que queriam democratizar o acesso a X...' },
        ]
      },
      {
        title: '06 — Visual e referências',
        fields: [
          { id: 'color_preferences', label: 'Tem preferência ou restrição de cores?', type: 'textarea', placeholder: 'Ex: tons de verde e dourado, nada de vermelho, paleta escura, cores vibrantes...' },
          { id: 'has_logo', label: 'Já tem um logo?', type: 'radio', options: ['Sim, o logo será mantido', 'Sim, mas será renovado junto', 'Não, criar do zero'] },
          { id: 'visual_references_files', label: 'Anexe referências visuais (moodboard, logos, prints)', type: 'file', hint: 'Quanto mais referências, mais precisa fica a direção criativa' },
          { id: 'existing_brand_files', label: 'Arquivos da marca atual (logo, materiais)', type: 'file', hint: 'PNG, SVG, AI, PDF — qualquer arquivo existente', condition: { field: 'has_logo', values: ['Sim, o logo será mantido', 'Sim, mas será renovado junto'] } },
        ]
      },
      {
        title: '07 — Materiais e aplicações',
        fields: [
          { id: 'deliverables', label: 'Quais materiais precisam da nova identidade?', type: 'multiselect', options: ['Logo (todas as variações)', 'Cartão de visita', 'Papel timbrado / envelope', 'Assinatura de email', 'Apresentação / pitch deck', 'Pasta de propostas', 'Redes sociais (templates de posts)', 'Sinalização / fachada', 'Embalagem / rótulo', 'Uniforme / bordado', 'Crachá', 'Brindes / merch'] },
          { id: 'applications', label: 'Quais aplicações são mais urgentes ou prioritárias?', type: 'textarea', placeholder: 'Ex: o cartão de visita precisa sair rápido, as redes sociais são o foco inicial...' },
        ]
      },
      {
        title: '08 — Prazo e aprovação',
        fields: [
          { id: 'deadline', label: 'Tem prazo ou data importante?', type: 'text', placeholder: 'Ex: lançamento em outubro, reunião com investidores em novembro...' },
          { id: 'approver', label: 'Quem dá a palavra final na aprovação?', type: 'text', placeholder: 'Nome e cargo de quem decide' },
          { id: 'filled_by', label: 'Quem preencheu este briefing?', type: 'text', placeholder: 'Deixe em branco se foi você mesmo — só preencha se for outra pessoa da equipe' },
          { id: 'extra_notes', label: 'Algo mais que queira nos contar?', type: 'textarea', placeholder: 'Contexto extra, história da empresa, restrições específicas...' },
        ]
      },
    ]
  },

  social: {
    type: 'social',
    label: 'Social Media',
    description: 'Gestão e criação de conteúdo para redes sociais',
    sections: [
      {
        title: '01 — Sobre a empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'segment', label: 'Segmento / área de atuação', type: 'text', required: true },
          { id: 'pitch', label: 'Descreva a empresa em UMA frase', type: 'textarea', required: true },
          { id: 'description', label: 'Descreva o que a empresa oferece', type: 'textarea', required: true, placeholder: 'Produtos, serviços, diferenciais, como funciona...' },
          { id: 'differentials', label: 'Quais são os principais diferenciais?', type: 'textarea', placeholder: 'O que te diferencia dos concorrentes?' },
          { id: 'unique_value_proposition', label: 'Por que o cliente escolhe você e não o concorrente?', type: 'textarea' },
        ]
      },
      {
        title: '02 — Estado atual das redes sociais',
        fields: [
          { id: 'networks', label: 'Redes sociais que já usa ou quer usar', type: 'multiselect', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X (Twitter)', 'Pinterest', 'WhatsApp Business', 'Threads'] },
          { id: 'current_profiles', label: 'Links dos perfis atuais', type: 'textarea', placeholder: 'Cole os links das redes que já existem — vamos analisar o que está funcionando' },
          { id: 'current_followers', label: 'Seguidores atuais (aproximado por rede)', type: 'text', placeholder: 'Ex: Instagram 2.3k, LinkedIn 800...' },
          { id: 'current_performance', label: 'O que tem funcionado bem no conteúdo atual?', type: 'textarea', placeholder: 'Tipos de post, temas, formatos que geram mais engajamento...' },
          { id: 'competitors', label: 'Concorrentes que você acompanha nas redes', type: 'textarea', placeholder: 'Perfis de referência — tanto positivos quanto negativos' },
        ]
      },
      {
        title: '03 — Objetivos e estratégia',
        fields: [
          { id: 'main_goal', label: 'Principal objetivo com as redes sociais', type: 'radio', required: true, options: ['Aumentar seguidores e alcance de marca', 'Gerar leads e captar clientes', 'Vender diretamente (social commerce)', 'Fortalecer a autoridade no setor', 'Engajar e fidelizar clientes existentes', 'Educar o público sobre o produto/serviço'] },
          { id: 'post_frequency', label: 'Frequência de posts esperada', type: 'radio', options: ['1-2x por semana', '3-4x por semana', '5-7x por semana (diário)', 'A definir estrategicamente'] },
        ]
      },
      {
        title: '04 — Público-alvo',
        fields: [
          { id: 'target_audience', label: 'Quem você quer alcançar?', type: 'textarea', required: true, hint: 'Perfil, faixa etária, comportamento, dores, o que consome online, plataformas que usa' },
        ]
      },
      {
        title: '05 — Tom, conteúdo e pilares',
        fields: [
          { id: 'content_tone', label: 'Tom de voz desejado', type: 'radio', required: true, options: ['Formal e profissional', 'Profissional mas próximo / acessível', 'Descontraído e próximo', 'Técnico e especialista', 'Divertido e irreverente'] },
          { id: 'content_types', label: 'Tipos de conteúdo que quer produzir', type: 'multiselect', options: ['Dicas e educação (conteúdo de valor)', 'Bastidores da empresa', 'Produtos / serviços em destaque', 'Cases e resultados de clientes', 'Promoções e ofertas', 'Depoimentos e prova social', 'Conteúdo do fundador (personal brand)', 'Notícias e tendências do setor', 'Memes e conteúdo leve', 'Reels e vídeos curtos', 'Lives e conteúdo ao vivo'] },
          { id: 'content_pillars', label: 'Temas ou pilares de conteúdo que fazem sentido para sua marca', type: 'textarea', placeholder: 'Ex: finanças pessoais, bem-estar, tendências de tech, dicas para empreendedores...' },
          { id: 'avoid', label: 'O que definitivamente NÃO quer no conteúdo?', type: 'textarea', placeholder: 'Temas, formatos, abordagens ou linguagem que devem ser evitados' },
        ]
      },
      {
        title: '06 — Produção de conteúdo',
        fields: [
          { id: 'who_produces', label: 'Quem vai produzir as fotos e vídeos?', type: 'radio', required: true, options: ['Vocês produzem tudo (fotógrafo, estúdio próprio)', 'Contrataremos fotógrafo / produtor junto', 'Usaremos banco de imagens e design', 'Mistura: parte produzida, parte banco de imagens', 'Ainda não definido'] },
          { id: 'has_brand', label: 'Situação da identidade visual', type: 'radio', options: ['Temos manual de marca completo', 'Temos logo e guia básico', 'Temos logo mas sem guia', 'Não temos identidade formalizada — precisamos criar'] },
          { id: 'brand_files', label: 'Anexe logo, manual de marca e referências visuais', type: 'file', hint: 'Quanto mais materiais existentes, mais consistente fica o conteúdo' },
        ]
      },
      {
        title: '07 — Referências visuais e de conteúdo',
        fields: [
          { id: 'style_references', label: 'Perfis ou marcas que admira na sua área', type: 'textarea', required: true, placeholder: 'Links de perfis que você acha bem feitos — mesmo que fora do seu setor' },
          { id: 'visual_references', label: 'Perfis com estética visual que você gosta', type: 'textarea', placeholder: 'Pode ser de qualquer setor — foco no estilo visual (cores, layout, foto, tipografia)' },
          { id: 'avoid_references', label: 'Estilos ou perfis que representam o que você NÃO quer', type: 'textarea', placeholder: 'Referências negativas ajudam tanto quanto as positivas' },
        ]
      },
      {
        title: '08 — Prazo e aprovação',
        fields: [
          { id: 'deadline', label: 'Quando quer começar a publicar?', type: 'text', placeholder: 'Ex: início de outubro, o mais rápido possível...' },
          { id: 'approver', label: 'Quem aprova os conteúdos antes de publicar?', type: 'text', placeholder: 'Nome de quem dá o OK final para ir ao ar' },
          { id: 'filled_by', label: 'Quem preencheu este briefing?', type: 'text', placeholder: 'Deixe em branco se foi você mesmo — só preencha se for outra pessoa da equipe' },
          { id: 'extra_notes', label: 'Algo mais que queira nos contar?', type: 'textarea', placeholder: 'Campanhas planejadas, datas comemorativas, restrições, contexto extra...' },
        ]
      },
    ]
  },

  site: {
    type: 'site',
    label: 'Criação de Site',
    description: 'Desenvolvimento de website, landing page ou plataforma',
    sections: [
      {
        title: '01 — Sobre a empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'segment', label: 'Segmento / área de atuação', type: 'text', required: true },
          { id: 'pitch', label: 'Descreva a empresa em UMA frase', type: 'textarea', required: true, placeholder: 'O pitch mais direto que você consegue fazer' },
          { id: 'description', label: 'Descreva em detalhes o que a empresa faz', type: 'textarea', required: true },
          { id: 'differentials', label: 'Principais diferenciais competitivos', type: 'textarea' },
          { id: 'unique_value_proposition', label: 'Proposta de valor única — por que você e não o concorrente?', type: 'textarea', required: true },
        ]
      },
      {
        title: '02 — Contexto do projeto',
        fields: [
          { id: 'is_redesign', label: 'Este projeto é...', type: 'radio', required: true, options: ['Site novo (não temos site)', 'Redesign completo do site atual', 'Melhoria / atualização do site atual', 'Landing page específica (campanha / produto)'] },
          { id: 'existing_site', label: 'Site atual (URL)', type: 'text', placeholder: 'https://...', condition: { field: 'is_redesign', values: ['Redesign completo do site atual', 'Melhoria / atualização do site atual', 'Complete redesign of current site', 'Improvement / update of current site'] } },
          { id: 'site_problems', label: 'O que não funciona no site atual?', type: 'textarea', placeholder: 'Seja específico: conversão baixa, visual desatualizado, lento, não responsivo...', condition: { field: 'is_redesign', values: ['Redesign completo do site atual', 'Melhoria / atualização do site atual', 'Complete redesign of current site', 'Improvement / update of current site'] } },
          { id: 'rebrand_reason', label: 'O que motivou a criação ou renovação do site?', type: 'textarea', required: true, placeholder: 'Ex: vamos lançar um produto novo, precisamos gerar mais leads, site antigo não representa mais a empresa...' },
        ]
      },
      {
        title: '03 — Mercado, público e posicionamento',
        fields: [
          { id: 'competitors', label: 'Concorrentes diretos (com sites)', type: 'textarea', required: true, placeholder: 'URLs dos concorrentes — vamos analisar o que está funcionando no mercado' },
          { id: 'icp', label: 'Cliente ideal (ICP) — quem entra no site e deve converter', type: 'textarea', required: true, hint: 'Perfil, cargo, empresa, dores, comportamento online, o que está procurando' },
          { id: 'buyer_objections', label: 'Quais são as maiores objeções que seu time de vendas ouve?', type: 'textarea', required: true, placeholder: 'Ex: "é caro", "não entendo como funciona", "não sei se confio", "como vocês se diferenciam da concorrência"...' },
          { id: 'positioning', label: 'Como você quer ser percebido ao chegar no site?', type: 'textarea', required: true, placeholder: 'Ex: "a Lurie é uma plataforma all-in-one de infraestrutura financeira. Resolvemos tudo."' },
        ]
      },
      {
        title: '04 — Objetivos e conversão',
        fields: [
          { id: 'site_type', label: 'Tipo de site', type: 'radio', required: true, options: ['Institucional (apresentar empresa e serviços)', 'Landing page (campanha ou produto específico)', 'E-commerce (venda de produtos)', 'Portal / plataforma (área do cliente, login)', 'Blog / mídia de conteúdo', 'Catálogo (sem carrinho, mas com produtos)'] },
          { id: 'main_goal', label: 'Principal objetivo do site', type: 'radio', required: true, options: ['Gerar leads (formulário de contato, agendamento)', 'Vender online (e-commerce)', 'Apresentar serviços e fortalecer credibilidade', 'Captar investidores / parceiros', 'Suporte e autoatendimento ao cliente'] },
          { id: 'desired_actions', label: 'O que você quer que o visitante faça ao se interessar?', type: 'textarea', required: true, placeholder: 'Ex: entrar em contato pelo formulário, agendar uma demo, fazer download, se inscrever na newsletter, comprar...' },
          { id: 'cta_priority', label: 'Prioridade dos CTAs (calls to action)', type: 'textarea', placeholder: 'Ex: 1º Agendar demo → 2º Falar com vendas → 3º Ver cases' },
        ]
      },
      {
        title: '05 — Arquitetura e conteúdo',
        fields: [
          { id: 'pages', label: 'Páginas necessárias', type: 'multiselect', options: ['Home (principal)', 'Sobre / Quem somos', 'Serviços / Produtos', 'Como funciona / Processo', 'Pricing / Planos', 'Portfolio / Cases', 'Blog / Conteúdo', 'FAQ / Perguntas frequentes', 'Contato', 'Área do cliente / Login', 'Parceiros / Integrações', 'Carreiras / Trabalhe conosco'] },
          { id: 'has_content', label: 'Situação dos textos e conteúdo', type: 'radio', options: ['Temos tudo pronto (textos, fotos, vídeos)', 'Temos parcialmente (precisam revisar / complementar)', 'Não temos — precisamos criar do zero'] },
          { id: 'who_writes', label: 'Quem vai escrever os textos do site?', type: 'radio', required: true, options: ['Nós mesmos (cliente)', 'Vocês (Bnny Labs)', 'Dividir: cliente escreve, vocês refinam', 'Contratar redator específico'], condition: { field: 'has_content', values: ['Parcialmente (precisam revisar / complementar)', 'Não temos — precisamos criar do zero', 'Partially ready (need revision / supplement)', 'Not ready — need to create from scratch'] } },
        ]
      },
      {
        title: '06 — Técnico',
        fields: [
          { id: 'domain', label: 'Situação do domínio (endereço do site)', type: 'radio', options: ['Já temos domínio registrado (ex: minhaempresa.com.br)', 'Precisamos registrar um novo domínio', 'Ainda não decidimos o domínio'] },
          { id: 'multilingual', label: 'O site precisa de mais de um idioma?', type: 'multiselect', options: ['Português (PT-BR)', 'Inglês (EN)', 'Espanhol (ES)', 'Outro'] },
          { id: 'integrations', label: 'Precisa conectar com algum sistema ou ferramenta?', type: 'multiselect', options: ['CRM (gestão de clientes)', 'WhatsApp (botão ou chat)', 'Chat ao vivo', 'E-mail marketing (newsletter)', 'Sistema de pagamento', 'Sistema interno da empresa', 'Agendamento online (tipo Calendly)', 'Não sei ainda'] },
          { id: 'seo_needed', label: 'Aparecer no Google (SEO) é prioridade?', type: 'radio', options: ['Sim — queremos ranquear nos resultados do Google', 'Mais ou menos — queremos o básico bem feito', 'Não é prioridade agora'] },
        ]
      },
      {
        title: '07 — Visual e referências',
        fields: [
          { id: 'has_brand', label: 'Situação da identidade visual', type: 'radio', required: true, options: ['Temos manual de marca completo', 'Temos logo e guia básico', 'Temos logo mas sem guia', 'Não temos — criar junto com o site'] },
          { id: 'style_references', label: 'Sites que admira como referência (de qualquer setor)', type: 'textarea', required: true, placeholder: 'URLs e o que especificamente você gosta em cada um — layout, hierarquia, animações, clareza...' },
          { id: 'avoid_references', label: 'Estilos ou sites que representam o que você NÃO quer', type: 'textarea', placeholder: 'Referências negativas são tão úteis quanto as positivas' },
          { id: 'visual_references_files', label: 'Anexe logo, manual de marca, prints de referência ou sitemap', type: 'file', hint: 'Qualquer material que ajude a entender a direção visual e de conteúdo' },
        ]
      },
      {
        title: '08 — Prazo e aprovação',
        fields: [
          { id: 'deadline', label: 'Tem prazo ou data de lançamento?', type: 'text', placeholder: 'Ex: outubro, antes do evento X, início do Q1, o mais rápido possível...' },
          { id: 'approver', label: 'Quem dá a palavra final na aprovação?', type: 'text', required: true, placeholder: 'Nome de quem decide — ex: Rafael Peixer (Founder)' },
          { id: 'filled_by', label: 'Quem preencheu este briefing?', type: 'text', placeholder: 'Deixe em branco se foi você mesmo — só preencha se for outra pessoa da equipe' },
          { id: 'attachments', label: 'Anexos (logo, identidade visual, textos, sitemap, referências)', type: 'file', hint: 'Aceita imagens, PDFs, documentos Word, apresentações' },
          { id: 'extra_notes', label: 'Algo mais que queira nos contar?', type: 'textarea', placeholder: 'Contexto extra, funcionalidades específicas, restrições, histórico do projeto...' },
        ]
      },
    ]
  },
}

// ─── ENGLISH TEMPLATES ───────────────────────────────────────────────────────

export const BRIEFING_TEMPLATES_EN: Record<BriefingType, BriefingTemplate> = {

  logo: {
    type: 'logo',
    label: 'Logo Design',
    description: 'Logotype, symbol and variations development',
    sections: [
      {
        title: '01 — About the company and the project',
        fields: [
          { id: 'company_name', label: 'Company / brand name', type: 'text', required: true },
          { id: 'slogan', label: 'Slogan or tagline', type: 'text', placeholder: 'Leave blank if none' },
          { id: 'segment', label: 'Industry / field of activity', type: 'text', required: true, placeholder: 'Ex: B2B Fintech, Fashion E-commerce, Dental Clinic...' },
          { id: 'pitch', label: 'Describe the company in ONE sentence', type: 'textarea', required: true, placeholder: 'Ex: "We are the platform connecting freelancers to tech companies in Brazil"' },
          { id: 'time_market', label: 'How long have you been in business?', type: 'text', placeholder: 'Ex: 3 years, just starting...' },
          { id: 'is_rebrand', label: 'This project is...', type: 'radio', required: true, options: ['Brand new creation (new brand)', 'Renewal / evolution of the current logo', 'Complete visual replacement'] },
        ]
      },
      {
        title: '02 — Project context',
        fields: [
          { id: 'rebrand_reason', label: 'What motivated the creation or renewal of the logo?', type: 'textarea', required: true, placeholder: 'Ex: The company grew and the logo no longer represents who we are. We want to convey more professionalism...' },
          { id: 'current_logo_problems', label: 'If renewal: what doesn\'t work in the current logo?', type: 'textarea', placeholder: 'Leave blank if it\'s a new brand. Be specific: colors, shape, typography, proportions...' },
          { id: 'keep_elements', label: 'What should be kept (if anything)?', type: 'textarea', placeholder: 'Ex: keep current colors, preserve icon element, keep the font...' },
        ]
      },
      {
        title: '03 — Market and references',
        fields: [
          { id: 'competitors', label: 'Who are your main direct competitors?', type: 'textarea', required: true, placeholder: 'List competitors and their websites/logos if possible' },
          { id: 'style_references', label: 'Companies or logos you admire as visual references', type: 'textarea', required: true, placeholder: 'Doesn\'t need to be from your industry — any well-crafted brand. Ex: Apple, Stripe, Airbnb...' },
          { id: 'avoid_references', label: 'References of what you definitely DON\'T want', type: 'textarea', placeholder: 'Logos, styles or brands representing what you want to avoid' },
        ]
      },
      {
        title: '04 — Target audience',
        fields: [
          { id: 'target_audience', label: 'Who is your ideal customer?', type: 'textarea', required: true, hint: 'Profile, age, behavior, values, pain points...' },
          { id: 'audience_perception', label: 'How should the logo be perceived by your audience?', type: 'textarea', placeholder: 'Ex: must convey trust and authority, cannot look amateur, needs to communicate technology...' },
        ]
      },
      {
        title: '05 — Personality and creative direction',
        fields: [
          { id: 'brand_personality', label: 'Adjectives that define the brand', type: 'multiselect', options: ['Modern', 'Classic', 'Bold', 'Elegant', 'Playful', 'Serious', 'Minimalist', 'Sophisticated', 'Accessible', 'Tech-forward', 'Human', 'Sustainable', 'Luxurious', 'Youthful', 'Traditional', 'Innovative', 'Institutional', 'Creative'] },
          { id: 'logo_style', label: 'Preferred logo style', type: 'multiselect', options: ['Text only (wordmark)', 'Symbol + text', 'Symbol / icon only', 'Monogram / initials', 'Mascot / character'] },
          { id: 'color_preferences', label: 'Color direction', type: 'textarea', placeholder: 'Ex: shades of blue and gray, something vibrant, no red, dark palette...' },
          { id: 'brand_feeling', label: 'What feeling should the logo evoke in your audience?', type: 'textarea', placeholder: 'Ex: trust, innovation, exclusivity, lightness, urgency...' },
        ]
      },
      {
        title: '06 — Applications and deliverables',
        fields: [
          { id: 'use_contexts', label: 'Where will the logo be used?', type: 'multiselect', options: ['Website / digital platform', 'Instagram', 'LinkedIn', 'WhatsApp / profile', 'Business card', 'Letterhead', 'Uniform / embroidery', 'Packaging', 'Billboard / banner', 'Physical product', 'Signage / storefront', 'Presentations (pitch, ppt)'] },
          { id: 'versions_needed', label: 'Required versions', type: 'multiselect', options: ['Horizontal', 'Vertical', 'Symbol / icon standalone', 'Dark background version', 'Light / white background version', 'Monochrome version', 'Small version (favicon, app icon)'] },
          { id: 'file_formats', label: 'Expected delivery formats', type: 'multiselect', options: ['PNG (transparent background)', 'SVG (editable vector)', 'PDF', 'AI (Adobe Illustrator)', 'EPS', 'Embroidery file (DST)', 'Cut file (CDR, DXF)'] },
        ]
      },
      {
        title: '07 — Timeline and approval',
        fields: [
          { id: 'deadline', label: 'Do you have a deadline or important date?', type: 'text', placeholder: 'Ex: August 15th, September launch, no set deadline...' },
          { id: 'approver', label: 'Who will give final approval?', type: 'text', placeholder: 'Name and title of the final decision maker' },
          { id: 'filled_by', label: 'Who filled this briefing?', type: 'text', placeholder: 'Leave blank if it was you — only fill if it was someone else from your team' },
          { id: 'visual_references_files', label: 'Attach visual references (logos you admire, prints, moodboard)', type: 'file', hint: 'Images, PDFs, screenshots — any visual reference is very helpful' },
          { id: 'existing_logo', label: 'Current logo (if any)', type: 'file', hint: 'PNG, SVG, AI, PDF — any format' },
          { id: 'extra_notes', label: 'Anything else you\'d like to share?', type: 'textarea', placeholder: 'Extra context, company history, inspirations, constraints...' },
        ]
      },
    ]
  },

  identidade: {
    type: 'identidade',
    label: 'Visual Identity',
    description: 'Complete visual identity creation for the brand',
    sections: [
      {
        title: '01 — About the company',
        fields: [
          { id: 'company_name', label: 'Company / brand name', type: 'text', required: true },
          { id: 'slogan', label: 'Slogan or tagline', type: 'text', placeholder: 'Leave blank if none' },
          { id: 'segment', label: 'Industry / field of activity', type: 'text', required: true },
          { id: 'pitch', label: 'Describe the company in ONE sentence', type: 'textarea', required: true },
          { id: 'description', label: 'Describe in detail what the company does', type: 'textarea', required: true },
          { id: 'time_market', label: 'How long have you been in business?', type: 'text' },
          { id: 'is_rebrand', label: 'This project is...', type: 'radio', required: true, options: ['Brand new creation (new brand)', 'Renewal / rebrand of current identity', 'Expansion of existing brand'] },
        ]
      },
      {
        title: '02 — Project context',
        fields: [
          { id: 'rebrand_reason', label: 'What motivated this project?', type: 'textarea', required: true },
          { id: 'keep_elements', label: 'What should be kept from the current brand?', type: 'textarea', placeholder: 'Leave blank if new brand' },
          { id: 'identity_goal', label: 'Main goal of this identity', type: 'radio', options: ['Convey more professionalism and credibility', 'Differentiate from competition', 'Reach a new audience', 'Reflect a new company phase', 'Prepare for growth / expansion'] },
        ]
      },
      {
        title: '03 — Market and competition',
        fields: [
          { id: 'competitors', label: 'Main direct competitors', type: 'textarea', required: true },
          { id: 'positioning', label: 'How do you want to be positioned vs. competitors?', type: 'textarea', required: true },
          { id: 'style_references', label: 'Brands and identities you admire (any industry)', type: 'textarea', required: true },
          { id: 'avoid_references', label: 'What you definitely DON\'T want', type: 'textarea' },
        ]
      },
      {
        title: '04 — Audience and positioning',
        fields: [
          { id: 'target_audience', label: 'Who is your target audience?', type: 'textarea', required: true },
          { id: 'unique_value_proposition', label: 'Value proposition — why you and not the competitor?', type: 'textarea', required: true },
        ]
      },
      {
        title: '05 — Brand personality',
        fields: [
          { id: 'brand_personality', label: 'Adjectives that define the brand', type: 'multiselect', options: ['Modern', 'Classic', 'Bold', 'Elegant', 'Playful', 'Serious', 'Minimalist', 'Sophisticated', 'Accessible', 'Tech-forward', 'Human', 'Sustainable', 'Luxurious', 'Youthful', 'Traditional', 'Innovative', 'Institutional', 'Creative', 'Trustworthy', 'Disruptive'] },
          { id: 'brand_tone', label: 'Brand tone of voice', type: 'radio', options: ['Formal and institutional', 'Professional but approachable', 'Casual and friendly', 'Technical and expert', 'Inspirational and aspirational'] },
          { id: 'brand_feeling', label: 'What feeling should the brand evoke?', type: 'textarea' },
          { id: 'brand_story', label: 'Is there a story or purpose behind the brand?', type: 'textarea' },
        ]
      },
      {
        title: '06 — Visual references',
        fields: [
          { id: 'color_preferences', label: 'Color preferences or restrictions?', type: 'textarea' },
          { id: 'has_logo', label: 'Do you have a current logo?', type: 'radio', options: ['Yes, keeping it as-is', 'Yes, but renewing it together', 'No, create from scratch'] },
          { id: 'visual_references_files', label: 'Attach visual references (moodboard, logos, prints)', type: 'file' },
          { id: 'existing_brand_files', label: 'Current brand files (logo, materials)', type: 'file' },
        ]
      },
      {
        title: '07 — Materials and applications',
        fields: [
          { id: 'deliverables', label: 'Which materials need the new identity?', type: 'multiselect', options: ['Logo (all versions)', 'Business card', 'Letterhead / envelope', 'Email signature', 'Presentation / pitch deck', 'Proposal folder', 'Social media templates', 'Signage / storefront', 'Packaging / label', 'Uniform / embroidery', 'Badge', 'Merch / gifts'] },
          { id: 'manual_needed', label: 'Is a brand guide / style manual required?', type: 'radio', options: ['Yes, complete (for internal and supplier use)', 'Yes, basic (main rules)', 'Not right now'] },
          { id: 'applications', label: 'Which applications are the priority?', type: 'textarea' },
        ]
      },
      {
        title: '08 — Timeline and approval',
        fields: [
          { id: 'deadline', label: 'Do you have a deadline or important date?', type: 'text' },
          { id: 'approver', label: 'Who will give final approval?', type: 'text' },
          { id: 'filled_by', label: 'Who filled this briefing?', type: 'text', placeholder: 'Leave blank if it was you — only fill if it was someone else from your team' },
          { id: 'extra_notes', label: 'Anything else you\'d like to share?', type: 'textarea' },
        ]
      },
    ]
  },

  social: {
    type: 'social',
    label: 'Social Media',
    description: 'Social media management and content creation',
    sections: [
      {
        title: '01 — About the company',
        fields: [
          { id: 'company_name', label: 'Company / brand name', type: 'text', required: true },
          { id: 'segment', label: 'Industry / field', type: 'text', required: true },
          { id: 'pitch', label: 'Describe the company in ONE sentence', type: 'textarea', required: true },
          { id: 'description', label: 'Describe what the company offers', type: 'textarea', required: true },
          { id: 'differentials', label: 'Main competitive differentials', type: 'textarea' },
          { id: 'unique_value_proposition', label: 'Why do customers choose you over competitors?', type: 'textarea' },
        ]
      },
      {
        title: '02 — Current social media state',
        fields: [
          { id: 'networks', label: 'Social networks you use or want to use', type: 'multiselect', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X (Twitter)', 'Pinterest', 'WhatsApp Business', 'Threads'] },
          { id: 'current_profiles', label: 'Links to current profiles', type: 'textarea' },
          { id: 'current_followers', label: 'Current followers (approx. per network)', type: 'text' },
          { id: 'current_performance', label: 'What\'s working well in current content?', type: 'textarea' },
          { id: 'competitors', label: 'Competitors you follow on social media', type: 'textarea' },
        ]
      },
      {
        title: '03 — Goals and strategy',
        fields: [
          { id: 'main_goal', label: 'Main goal on social media', type: 'radio', required: true, options: ['Grow followers and brand reach', 'Generate leads and acquire customers', 'Sell directly (social commerce)', 'Build industry authority', 'Engage and retain existing customers', 'Educate the audience about the product/service'] },
          { id: 'post_frequency', label: 'Expected posting frequency', type: 'radio', options: ['1-2x per week', '3-4x per week', '5-7x per week (daily)', 'To be defined strategically'] },
        ]
      },
      {
        title: '04 — Target audience',
        fields: [
          { id: 'target_audience', label: 'Who do you want to reach?', type: 'textarea', required: true },
        ]
      },
      {
        title: '05 — Tone, content and pillars',
        fields: [
          { id: 'content_tone', label: 'Desired tone of voice', type: 'radio', required: true, options: ['Formal and professional', 'Professional but approachable', 'Casual and friendly', 'Technical and expert', 'Fun and irreverent'] },
          { id: 'content_types', label: 'Types of content you want to produce', type: 'multiselect', options: ['Tips and education (value content)', 'Behind the scenes', 'Products / services highlights', 'Customer cases and results', 'Promotions and offers', 'Testimonials and social proof', 'Founder content (personal brand)', 'Industry news and trends', 'Memes and light content', 'Reels and short videos', 'Lives and real-time content'] },
          { id: 'content_pillars', label: 'Content themes or pillars that make sense for your brand', type: 'textarea' },
          { id: 'avoid', label: 'What you definitely DON\'T want in content', type: 'textarea' },
        ]
      },
      {
        title: '06 — Content production',
        fields: [
          { id: 'who_produces', label: 'Who will produce photos and videos?', type: 'radio', required: true, options: ['You (own photographer, studio)', 'We\'ll hire photographer / producer together', 'Stock images and design', 'Mix: some produced, some stock', 'Not yet defined'] },
          { id: 'has_brand', label: 'Visual identity status', type: 'radio', options: ['We have a complete brand guide', 'We have logo and basic guidelines', 'We have a logo but no guidelines', 'No formal identity — need to create'] },
          { id: 'brand_files', label: 'Attach logo, brand guide and visual references', type: 'file' },
        ]
      },
      {
        title: '07 — Visual and content references',
        fields: [
          { id: 'style_references', label: 'Profiles or brands you admire in your space', type: 'textarea', required: true },
          { id: 'visual_references', label: 'Profiles with visual style you like', type: 'textarea' },
          { id: 'avoid_references', label: 'Styles or profiles representing what you DON\'T want', type: 'textarea' },
        ]
      },
      {
        title: '08 — Timeline and approval',
        fields: [
          { id: 'deadline', label: 'When do you want to start publishing?', type: 'text' },
          { id: 'approver', label: 'Who will approve content before publishing?', type: 'text' },
          { id: 'filled_by', label: 'Who filled this briefing?', type: 'text', placeholder: 'Leave blank if it was you — only fill if it was someone else from your team' },
          { id: 'extra_notes', label: 'Anything else you\'d like to share?', type: 'textarea' },
        ]
      },
    ]
  },

  site: {
    type: 'site',
    label: 'Website Creation',
    description: 'Website, landing page or platform development',
    sections: [
      {
        title: '01 — About the company',
        fields: [
          { id: 'company_name', label: 'Company / brand name', type: 'text', required: true },
          { id: 'segment', label: 'Industry / field', type: 'text', required: true },
          { id: 'pitch', label: 'Describe the company in ONE sentence', type: 'textarea', required: true },
          { id: 'description', label: 'Describe in detail what the company does', type: 'textarea', required: true },
          { id: 'differentials', label: 'Main competitive differentials', type: 'textarea' },
          { id: 'unique_value_proposition', label: 'Value proposition — why you and not the competitor?', type: 'textarea', required: true },
        ]
      },
      {
        title: '02 — Project context',
        fields: [
          { id: 'is_redesign', label: 'This project is...', type: 'radio', required: true, options: ['New website (no current site)', 'Complete redesign of current site', 'Improvement / update of current site', 'Specific landing page (campaign / product)'] },
          { id: 'existing_site', label: 'Current website (URL)', type: 'text', placeholder: 'https://... — leave blank if none' },
          { id: 'site_problems', label: 'What doesn\'t work on the current site?', type: 'textarea', placeholder: 'Only fill if redesign — be specific: low conversion, outdated, slow, not mobile-friendly...' },
          { id: 'rebrand_reason', label: 'What motivated this project?', type: 'textarea', required: true },
        ]
      },
      {
        title: '03 — Market, audience and positioning',
        fields: [
          { id: 'competitors', label: 'Direct competitors (with websites)', type: 'textarea', required: true },
          { id: 'icp', label: 'Ideal customer (ICP) — who visits and should convert', type: 'textarea', required: true },
          { id: 'buyer_objections', label: 'Biggest objections your sales team hears', type: 'textarea', required: true },
          { id: 'positioning', label: 'How do you want to be perceived on arrival?', type: 'textarea', required: true },
        ]
      },
      {
        title: '04 — Goals and conversion',
        fields: [
          { id: 'site_type', label: 'Type of website', type: 'radio', required: true, options: ['Institutional (present company and services)', 'Landing page (specific campaign or product)', 'E-commerce (product sales)', 'Portal / platform (client area, login)', 'Blog / content media', 'Catalog (no cart, but with products)'] },
          { id: 'main_goal', label: 'Main goal of the website', type: 'radio', required: true, options: ['Generate leads (contact form, scheduling)', 'Sell online (e-commerce)', 'Present services and strengthen credibility', 'Attract investors / partners', 'Customer support and self-service'] },
          { id: 'desired_actions', label: 'What do you want visitors to do when interested?', type: 'textarea', required: true },
          { id: 'cta_priority', label: 'Priority of CTAs (calls to action)', type: 'textarea' },
        ]
      },
      {
        title: '05 — Architecture and content',
        fields: [
          { id: 'pages', label: 'Required pages', type: 'multiselect', options: ['Home (main)', 'About us', 'Services / Products', 'How it works / Process', 'Pricing / Plans', 'Portfolio / Cases', 'Blog / Content', 'FAQ', 'Contact', 'Client area / Login', 'Partners / Integrations', 'Careers'] },
          { id: 'has_content', label: 'Content (texts, photos, videos) status', type: 'radio', options: ['All ready', 'Partially ready (need revision / supplement)', 'Not ready — need to create from scratch'] },
          { id: 'who_writes', label: 'Who will write the website copy?', type: 'radio', required: true, options: ['Us (client)', 'You (Bnny Labs)', 'Split: we write, you refine', 'Hire a dedicated copywriter'] },
        ]
      },
      {
        title: '06 — Technical',
        fields: [
          { id: 'domain', label: 'Domain (website address) status', type: 'radio', options: ['Already have a registered domain (e.g. mycompany.com)', 'Need to register a new domain', 'Not decided yet'] },
          { id: 'multilingual', label: 'Does the site need multiple languages?', type: 'multiselect', options: ['Portuguese (PT-BR)', 'English (EN)', 'Spanish (ES)', 'Other'] },
          { id: 'integrations', label: 'Does it need to connect with any system or tool?', type: 'multiselect', options: ['CRM (customer management)', 'WhatsApp (button or chat)', 'Live chat', 'Email marketing (newsletter)', 'Payment system', 'Internal company system', 'Online scheduling (like Calendly)', 'Not sure yet'] },
          { id: 'seo_needed', label: 'Is ranking on Google (SEO) a priority?', type: 'radio', options: ['Yes — we want to rank in Google results', 'Somewhat — we want the basics done right', 'Not a priority right now'] },
        ]
      },
      {
        title: '07 — Visual and references',
        fields: [
          { id: 'has_brand', label: 'Visual identity status', type: 'radio', required: true, options: ['We have a complete brand guide', 'We have logo and basic guidelines', 'We have a logo but no guidelines', 'No identity — create alongside the site'] },
          { id: 'style_references', label: 'Sites you admire as references (any industry)', type: 'textarea', required: true },
          { id: 'avoid_references', label: 'Styles or sites representing what you DON\'T want', type: 'textarea' },
          { id: 'visual_references_files', label: 'Attach logo, brand guide, references or sitemap', type: 'file' },
        ]
      },
      {
        title: '08 — Timeline and approval',
        fields: [
          { id: 'deadline', label: 'Do you have a launch date or deadline?', type: 'text' },
          { id: 'approver', label: 'Who will give final approval?', type: 'text', required: true },
          { id: 'filled_by', label: 'Who filled this briefing?', type: 'text', placeholder: 'Leave blank if it was you — only fill if it was someone else from your team' },
          { id: 'attachments', label: 'Attachments (logo, brand identity, copy, sitemap, references)', type: 'file' },
          { id: 'extra_notes', label: 'Anything else you\'d like to share?', type: 'textarea' },
        ]
      },
    ]
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTemplate(type: BriefingType, language: BriefingLanguage = 'pt-BR') {
  return language === 'en-US' ? BRIEFING_TEMPLATES_EN[type] : BRIEFING_TEMPLATES[type]
}

export function generateSlug(company: string): string {
  const base = company
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}
