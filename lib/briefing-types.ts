export type BriefingType = 'identidade' | 'social' | 'site' | 'logo'

export interface BriefingField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'file'
  placeholder?: string
  options?: string[]
  required?: boolean
  hint?: string
}

export interface BriefingTemplate {
  type: BriefingType
  label: string
  description: string
  sections: {
    title: string
    fields: BriefingField[]
  }[]
}

export const BRIEFING_TEMPLATES: Record<BriefingType, BriefingTemplate> = {
  identidade: {
    type: 'identidade',
    label: 'Identidade Visual',
    description: 'Criação completa de identidade visual da marca',
    sections: [
      {
        title: 'Sobre a Empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'segment', label: 'Segmento / área de atuação', type: 'text', required: true },
          { id: 'description', label: 'O que a empresa faz?', type: 'textarea', placeholder: 'Descreva brevemente o que sua empresa oferece...', required: true },
          { id: 'differentials', label: 'Quais são os diferenciais da empresa?', type: 'textarea', placeholder: 'O que te diferencia da concorrência?' },
          { id: 'time_market', label: 'Há quanto tempo está no mercado?', type: 'text' },
        ]
      },
      {
        title: 'Público e Posicionamento',
        fields: [
          { id: 'target_audience', label: 'Quem é o público-alvo?', type: 'textarea', required: true, hint: 'Idade, perfil, comportamento, dores...' },
          { id: 'positioning', label: 'Como você quer ser percebido pelo mercado?', type: 'textarea' },
          { id: 'competitors', label: 'Quem são os principais concorrentes?', type: 'textarea' },
          { id: 'price_positioning', label: 'Posicionamento de preço', type: 'radio', options: ['Premium / Alto padrão', 'Intermediário', 'Acessível / Popular'] },
        ]
      },
      {
        title: 'Personalidade da Marca',
        fields: [
          { id: 'brand_personality', label: 'Escolha adjetivos que definem sua marca', type: 'multiselect', options: ['Moderna', 'Clássica', 'Ousada', 'Elegante', 'Divertida', 'Séria', 'Minimalista', 'Sofisticada', 'Acessível', 'Tecnológica', 'Humana', 'Sustentável'] },
          { id: 'brand_tone', label: 'Tom de voz da marca', type: 'radio', options: ['Formal e institucional', 'Profissional mas próximo', 'Descontraído e jovem', 'Técnico e especialista'] },
          { id: 'brand_feeling', label: 'Que sentimento a marca deve despertar?', type: 'textarea', placeholder: 'Ex: confiança, inovação, acolhimento...' },
        ]
      },
      {
        title: 'Referências Visuais',
        fields: [
          { id: 'color_preferences', label: 'Tem preferência de cores?', type: 'textarea', placeholder: 'Ex: tons de azul, paleta neutra, nada de vermelho...' },
          { id: 'style_references', label: 'Marcas ou logos que admira (como referência, não cópia)', type: 'textarea' },
          { id: 'avoid', label: 'O que definitivamente NÃO quer na identidade?', type: 'textarea', placeholder: 'Estilos, cores, elementos que devem ser evitados' },
          { id: 'deliverables', label: 'Quais materiais precisam do novo visual?', type: 'multiselect', options: ['Logo', 'Cartão de visita', 'Papel timbrado', 'Apresentação', 'Redes sociais', 'Sinalização', 'Embalagem', 'Uniforme'] },
          { id: 'visual_references_files', label: 'Anexe referências visuais (logos, imagens, prints)', type: 'file', hint: 'Imagens, PDFs ou qualquer material de referência' },
          { id: 'existing_logo', label: 'Anexe o logo atual (se tiver)', type: 'file', hint: 'PNG, SVG, AI, PDF' },
        ]
      },
      {
        title: 'Informações de Contato',
        fields: [
          { id: 'responsible_name', label: 'Nome do responsável', type: 'text', required: true },
          { id: 'responsible_email', label: 'Email principal de contato', type: 'text', required: true },
          { id: 'responsible_phone', label: 'WhatsApp / celular', type: 'text', required: true },
          { id: 'attachments', label: 'Anexos (logo atual, referências, materiais)', type: 'file', hint: 'Aceita imagens, PDFs e documentos' },
          { id: 'extra_notes', label: 'Algo mais que queira nos contar?', type: 'textarea' },
        ]
      }
    ]
  },

  logo: {
    type: 'logo',
    label: 'Criação de Logo',
    description: 'Desenvolvimento de logotipo e variações',
    sections: [
      {
        title: 'Sobre a Empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'slogan', label: 'Tem slogan? Qual?', type: 'text', placeholder: 'Deixe em branco se não tiver' },
          { id: 'segment', label: 'Segmento de atuação', type: 'text', required: true },
          { id: 'description', label: 'O que a empresa faz?', type: 'textarea', required: true },
        ]
      },
      {
        title: 'Público e Personalidade',
        fields: [
          { id: 'target_audience', label: 'Público-alvo', type: 'textarea', required: true },
          { id: 'brand_personality', label: 'Palavras que definem a marca', type: 'multiselect', options: ['Moderna', 'Clássica', 'Ousada', 'Elegante', 'Divertida', 'Séria', 'Minimalista', 'Sofisticada', 'Acessível', 'Tecnológica'] },
          { id: 'logo_style', label: 'Estilo de logo preferido', type: 'multiselect', options: ['Só texto (wordmark)', 'Símbolo + texto', 'Só símbolo', 'Monograma / inicial', 'Mascote'] },
        ]
      },
      {
        title: 'Visual',
        fields: [
          { id: 'color_preferences', label: 'Preferência de cores', type: 'textarea' },
          { id: 'style_references', label: 'Logos que admira como referência', type: 'textarea' },
          { id: 'avoid', label: 'O que NÃO quer no logo', type: 'textarea' },
          { id: 'use_contexts', label: 'Onde o logo será usado?', type: 'multiselect', options: ['Site', 'Instagram', 'WhatsApp', 'Cartão', 'Uniforme', 'Embalagem', 'Outdoor', 'Produto físico'] },
          { id: 'visual_references_files', label: 'Anexe referências visuais (logos que admira)', type: 'file', hint: 'Imagens, PDFs ou prints de referência' },
          { id: 'existing_logo', label: 'Tem logo atual? Anexe aqui', type: 'file', hint: 'PNG, SVG, AI, PDF — qualquer formato' },
        ]
      },
      {
        title: 'Contato',
        fields: [
          { id: 'responsible_name', label: 'Nome do responsável', type: 'text', required: true },
          { id: 'responsible_email', label: 'Email principal de contato', type: 'text', required: true },
          { id: 'responsible_phone', label: 'WhatsApp / celular', type: 'text', required: true },
          { id: 'extra_notes', label: 'Informações adicionais', type: 'textarea' },
        ]
      }
    ]
  },

  social: {
    type: 'social',
    label: 'Social Media',
    description: 'Gestão e criação de conteúdo para redes sociais',
    sections: [
      {
        title: 'Sobre a Empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'segment', label: 'Segmento', type: 'text', required: true },
          { id: 'description', label: 'O que a empresa oferece?', type: 'textarea', required: true },
          { id: 'differentials', label: 'Diferenciais principais', type: 'textarea' },
        ]
      },
      {
        title: 'Redes e Objetivos',
        fields: [
          { id: 'networks', label: 'Redes sociais ativas', type: 'multiselect', options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'X (Twitter)', 'Pinterest', 'WhatsApp Business'] },
          { id: 'main_goal', label: 'Principal objetivo nas redes', type: 'radio', options: ['Aumentar seguidores / alcance', 'Gerar vendas / leads', 'Fortalecer a marca', 'Engajar comunidade existente', 'Educar o público'] },
          { id: 'post_frequency', label: 'Frequência esperada de posts', type: 'radio', options: ['1-2x por semana', '3-4x por semana', 'Diariamente', 'Não sei, sugiram'] },
        ]
      },
      {
        title: 'Público e Tom',
        fields: [
          { id: 'target_audience', label: 'Público-alvo', type: 'textarea', required: true, hint: 'Quem você quer alcançar? Perfil, idade, comportamento...' },
          { id: 'content_tone', label: 'Tom de voz desejado', type: 'radio', options: ['Formal e profissional', 'Descontraído e próximo', 'Técnico e especialista', 'Divertido e irreverente'] },
          { id: 'content_types', label: 'Tipos de conteúdo desejados', type: 'multiselect', options: ['Dicas e educação', 'Bastidores', 'Produtos/serviços', 'Cases e resultados', 'Promoções', 'Memes e humor', 'Depoimentos', 'Notícias do setor'] },
        ]
      },
      {
        title: 'Visual',
        fields: [
          { id: 'has_brand', label: 'Já tem identidade visual definida?', type: 'radio', options: ['Sim, temos manual de marca', 'Sim, mas não é formalizado', 'Não, precisamos criar'] },
          { id: 'color_palette', label: 'Cores da marca (se tiver)', type: 'text' },
          { id: 'visual_references', label: 'Perfis que admira como referência visual', type: 'textarea' },
          { id: 'avoid', label: 'O que não quer ver no conteúdo', type: 'textarea' },
          { id: 'brand_files', label: 'Anexe manual de marca, logo ou referências visuais', type: 'file', hint: 'Imagens, PDFs, apresentações' },
        ]
      },
      {
        title: 'Contato',
        fields: [
          { id: 'responsible_name', label: 'Nome do responsável', type: 'text', required: true },
          { id: 'responsible_email', label: 'Email principal de contato', type: 'text', required: true },
          { id: 'responsible_phone', label: 'WhatsApp / celular', type: 'text', required: true },
          { id: 'current_profiles', label: 'Links dos perfis atuais (se tiver)', type: 'textarea' },
          { id: 'extra_notes', label: 'Algo mais?', type: 'textarea' },
        ]
      }
    ]
  },

  site: {
    type: 'site',
    label: 'Criação de Site',
    description: 'Desenvolvimento de website institucional ou landing page',
    sections: [
      {
        title: 'Sobre a Empresa',
        fields: [
          { id: 'company_name', label: 'Nome da empresa / marca', type: 'text', required: true },
          { id: 'segment', label: 'Segmento', type: 'text', required: true },
          { id: 'description', label: 'O que a empresa faz?', type: 'textarea', required: true },
          { id: 'differentials', label: 'Diferenciais e pontos fortes', type: 'textarea' },
        ]
      },
      {
        title: 'Objetivo do Site',
        fields: [
          { id: 'site_type', label: 'Tipo de site', type: 'radio', options: ['Institucional (apresentar a empresa)', 'Landing page (campanha / produto)', 'Blog / conteúdo', 'E-commerce', 'Portal / plataforma'], required: true },
          { id: 'main_goal', label: 'Principal objetivo do site', type: 'radio', options: ['Gerar leads / capturar contatos', 'Vender online', 'Apresentar serviços/produtos', 'Fortalecer credibilidade', 'Suporte ao cliente'] },
          { id: 'desired_actions', label: 'O que você quer que o visitante faça?', type: 'textarea', placeholder: 'Ex: entrar em contato, agendar, comprar, se inscrever...' },
        ]
      },
      {
        title: 'Conteúdo e Páginas',
        fields: [
          { id: 'pages', label: 'Páginas necessárias', type: 'multiselect', options: ['Home', 'Sobre / Quem somos', 'Serviços / Produtos', 'Portfolio / Cases', 'Blog', 'FAQ', 'Contato', 'Área do cliente'] },
          { id: 'has_content', label: 'Tem conteúdo (textos, fotos) prontos?', type: 'radio', options: ['Sim, tudo pronto', 'Parcialmente', 'Não, precisam criar'] },
          { id: 'existing_site', label: 'Tem site atual? URL:', type: 'text', placeholder: 'https://...' },
        ]
      },
      {
        title: 'Visual e Técnico',
        fields: [
          { id: 'style_references', label: 'Sites que admira como referência', type: 'textarea' },
          { id: 'avoid', label: 'O que não quer no site', type: 'textarea' },
          { id: 'has_brand', label: 'Tem identidade visual?', type: 'radio', options: ['Sim, completa', 'Parcial', 'Não, criar junto'] },
          { id: 'domain', label: 'Tem domínio? Qual?', type: 'text', placeholder: 'Ex: minhaempresa.com.br' },
          { id: 'integrations', label: 'Precisa de integrações?', type: 'multiselect', options: ['WhatsApp', 'CRM', 'E-mail marketing', 'Analytics', 'Redes sociais', 'Sistema de pagamento', 'Chat online'] },
        ]
      },
      {
        title: 'Contato',
        fields: [
          { id: 'responsible_name', label: 'Nome do responsável', type: 'text', required: true },
          { id: 'responsible_email', label: 'Email principal de contato', type: 'text', required: true },
          { id: 'responsible_phone', label: 'WhatsApp / celular', type: 'text', required: true },
          { id: 'deadline', label: 'Tem prazo ou data importante?', type: 'text' },
          { id: 'attachments', label: 'Anexos (logo, identidade visual, conteúdo)', type: 'file', hint: 'Aceita imagens, PDFs e documentos' },
          { id: 'extra_notes', label: 'Informações adicionais', type: 'textarea' },
        ]
      }
    ]
  }
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
