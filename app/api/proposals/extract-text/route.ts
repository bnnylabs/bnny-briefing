import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'

/**
 * POST /api/proposals/extract-text
 *
 * Extrai texto de TXT ou PDF para uso como contexto adicional na geração
 * de proposta com IA. Sem custo de IA — usa parser local (pdf-parse).
 *
 * Aceita FormData com campo "file". Limite de 5MB.
 *
 * Resposta:
 *   200 { text: string, charCount: number }
 *     - text vazio quando o PDF é só imagem/scan (sem camada de texto)
 *   400 { error: string }    para input inválido
 *   500 { error: string }    para falha no parser
 *
 * NOTA sobre PDFs scaneados: pdf-parse extrai apenas texto vetorial. PDFs
 * que são "fotos" de documento devolverão string vazia. O frontend deve
 * tratar esse caso oferecendo o caminho C (Claude lê visualmente).
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = new Set([
  'text/plain',
  'application/pdf',
])

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Campo "file" obrigatório' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande (limite: ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
      { status: 400 },
    )
  }

  // Type check — mas alguns browsers não setam mime corretamente, então
  // também validamos pela extensão como fallback.
  const fileName = file.name.toLowerCase()
  const isTxt = file.type === 'text/plain' || fileName.endsWith('.txt')
  const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf')

  if (!isTxt && !isPdf && !ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Apenas TXT e PDF são suportados' },
      { status: 400 },
    )
  }

  let text = ''

  try {
    if (isTxt) {
      text = await file.text()
    } else if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer())
      // Dynamic import — pdf-parse pesa ~1MB e só carrega quando necessário.
      // Tipos do @types/pdf-parse esperam o módulo default; o pacote v2 já
      // exporta funções nomeadas, então acessamos via cast.
      const pdfParse = (await import('pdf-parse')) as unknown as {
        default: (data: Buffer) => Promise<{ text: string }>
      }
      const result = await pdfParse.default(buffer)
      text = result.text ?? ''
    }
  } catch (err) {
    console.error('[extract-text] parse failed:', err)
    return NextResponse.json(
      {
        error:
          'Não consegui extrair texto desse arquivo. Pode ser um PDF scaneado ou corrompido.',
      },
      { status: 500 },
    )
  }

  // Trim e normaliza whitespace mas preserva quebras de parágrafo
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return NextResponse.json({
    text,
    charCount: text.length,
  })
}
