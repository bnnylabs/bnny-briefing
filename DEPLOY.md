# 🚀 Bnny Labs — Guia de Deploy

## 1. Configurar banco de dados (Supabase)

1. Acesse **supabase.com** → seu projeto → **SQL Editor**
2. Cole e execute o conteúdo do arquivo `supabase/schema.sql`
3. Isso cria as tabelas de clientes, briefings e respostas

---

## 2. Subir código no GitHub

1. Crie uma conta em **github.com** (se não tiver)
2. Crie um novo repositório chamado `bnny-briefing` (privado)
3. Faça upload da pasta do projeto:

```bash
git init
git add .
git commit -m "Bnny Labs briefing system"
git remote add origin https://github.com/SEU_USUARIO/bnny-briefing.git
git push -u origin main
```

---

## 3. Deploy no Vercel

1. Acesse **vercel.com** → **New Project**
2. Conecte seu GitHub e selecione o repositório `bnny-briefing`
3. Na seção **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | sua chave da Anthropic |
| `NEXT_PUBLIC_SUPABASE_URL` | https://iljwzwwebzoevmxjfqbi.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sua anon key do Supabase |
| `SUPABASE_SERVICE_KEY` | sua service key do Supabase |
| `ADMIN_PASSWORD` | sua senha (escolha uma forte) |
| `NOTIFICATION_EMAIL` | seu email para notificações |
| `NEXT_PUBLIC_BASE_URL` | https://briefing.bnnylabs.com |

4. Clique em **Deploy**

---

## 4. Conectar domínio (Hover + Vercel)

### No Vercel:
1. Vá em **Settings → Domains**
2. Adicione `briefing.bnnylabs.com`
3. O Vercel vai te mostrar os registros DNS necessários

### No Hover (hover.com):
1. Acesse o painel do seu domínio `bnnylabs.com`
2. Vá em **DNS** → **Edit DNS**
3. Adicione um registro **CNAME**:
   - **Host:** `briefing`
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** 3600

Aguarde até 30 minutos para propagar. Após isso, `briefing.bnnylabs.com` estará no ar!

---

## 5. Adicionar notificações por email (opcional, recomendado)

Para receber email quando um cliente conclui um briefing:

1. Crie conta em **resend.com** (gratuito, 100 emails/dia)
2. Obtenha a API Key
3. Adicione no Vercel: `RESEND_API_KEY` = sua key
4. No arquivo `app/api/briefings/[slug]/submit/route.ts`, descomente o bloco de email

---

## Pronto! 🎉

Seu sistema estará acessível em:
- **Painel admin:** `briefing.bnnylabs.com/admin`
- **Briefings dos clientes:** `briefing.bnnylabs.com/[slug]`

---

## Senha padrão do admin

Defina `ADMIN_PASSWORD` nas variáveis do Vercel.
Por padrão é `bnny2024` — **mude antes de ir ao ar!**
