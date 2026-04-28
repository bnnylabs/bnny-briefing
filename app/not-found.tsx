import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Default 404 page for any unmatched route.
 *
 * Brand-aligned (mint-teal, monospace heading) so it doesn't feel like
 * a stock framework page. The 'Voltar pro admin' CTA covers the most
 * common cause: the owner mistyped a slug or hit a stale link.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="mb-2 font-mono text-6xl font-bold tracking-tighter text-primary">
        404
      </div>
      <h1 className="mb-2 text-lg font-bold tracking-tight">
        Página não encontrada
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        O endereço que você procura não existe — pode ter sido movido ou
        o link está errado.
      </p>
      <Button asChild>
        <Link href="/admin">Voltar pro admin</Link>
      </Button>
    </div>
  )
}
