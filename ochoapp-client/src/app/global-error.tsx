'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

type AppError = Error & {
  digest?: string
  stack?: string
  cause?: unknown
}

interface GlobalErrorProps {
  error: AppError
  reset: () => void
}

const getErrorDetails = (error: AppError) => ({
  name: error?.name,
  message: error?.message,
  stack: error?.stack,
  digest: error?.digest,
  cause: error?.cause,
  href: typeof window !== 'undefined' ? window.location.href : undefined,
  pathname:
    typeof window !== 'undefined' ? window.location.pathname : undefined,
  search:
    typeof window !== 'undefined' ? window.location.search : undefined,
  userAgent:
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  timestamp: new Date().toISOString(),
})

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[global-error.tsx] Critical app error:', getErrorDetails(error))
  }, [error])

  return (
    <html>
      <body>
        <main className='fixed inset-0 flex items-center justify-center bg-background p-4'>
          <div className='max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center shadow-lg'>
            <div className='flex justify-center'>
              <AlertTriangle className='size-16 text-destructive' />
            </div>

            <div className='space-y-3'>
              <h1 className='text-2xl font-bold text-foreground'>
                Erreur critique
              </h1>
              <p className='text-muted-foreground'>
                L'application a rencontré un problème grave. Nous travaillons à la 
                résolution.
              </p>
            </div>

            {/* Debug info en dev seulement */}
            {process.env.NODE_ENV === 'development' && (
              <div className='rounded-md bg-destructive/10 p-4 text-left'>
                {error?.digest && (
                  <p className='mb-2 text-xs font-semibold text-destructive'>
                    Digest: {error.digest}
                  </p>
                )}
                <pre className='overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-destructive'>
                  {error?.stack || error?.message}
                </pre>
              </div>
            )}

            <div className='flex gap-3'>
              <button
                onClick={() => reset()}
                className='flex-1 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              >
                Réessayer
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className='flex-1 rounded-md border border-border px-4 py-3 font-medium text-foreground transition-colors hover:bg-accent'
              >
                Accueil
              </button>
            </div>

            <p className='text-xs text-muted-foreground'>
              Si le problème persiste, contactez le support.
            </p>
          </div>
        </main>
      </body>
    </html>
  )
}
