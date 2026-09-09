'use client'

import { AlertCircle, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

type AppError = Error & {
  digest?: string
  stack?: string
  cause?: unknown
}

interface ErrorProps {
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

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[error.tsx] Error caught by client boundary:', getErrorDetails(error))
  }, [error])

  const isNetworkError = 
    error?.message?.includes('network') ||
    error?.message?.includes('offline') ||
    error?.message?.includes('fetch')

  const isClientError = error?.message?.includes('404')
  
  const isDbError = 
    error?.message?.includes('Prisma') ||
    error?.message?.includes('database') ||
    error?.message?.includes('query')

  return (
    <main className='fixed inset-0 flex items-center justify-center bg-background p-4'>
      <div className='max-w-md space-y-6 rounded-lg border border-border bg-card p-6 text-center shadow-lg'>
        <div className='flex justify-center'>
          <AlertCircle className='size-12 text-destructive' />
        </div>

        <div className='space-y-2'>
          {isNetworkError && (
            <>
              <h2 className='text-xl font-bold text-foreground'>
                Problème de connexion
              </h2>
              <p className='text-sm text-muted-foreground'>
                Vérifiez votre connexion réseau et réessayez
              </p>
            </>
          )}

          {isDbError && (
            <>
              <h2 className='text-xl font-bold text-foreground'>
                Service temporairement indisponible
              </h2>
              <p className='text-sm text-muted-foreground'>
                Le serveur rencontre des difficultés. Nous y travaillons.
              </p>
            </>
          )}

          {isClientError && (
            <>
              <h2 className='text-xl font-bold text-foreground'>
                Page non trouvée
              </h2>
              <p className='text-sm text-muted-foreground'>
                Cette page n'existe pas ou a été supprimée
              </p>
            </>
          )}

          {!isNetworkError && !isDbError && !isClientError && (
            <>
              <h2 className='text-xl font-bold text-foreground'>
                Une erreur est survenue
              </h2>
              <p className='text-sm text-muted-foreground'>
                Quelque chose s'est mal passé. Veuillez réessayer.
              </p>
            </>
          )}
        </div>

        {/* Afficher le détail en développement */}
        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className='space-y-2 rounded bg-destructive/10 p-3 text-left'>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-destructive'>
              Détails techniques (dev only)
            </p>
            {error.digest && (
              <p className='text-[10px] text-destructive'>Digest: {error.digest}</p>
            )}
            <pre className='overflow-auto whitespace-pre-wrap wrap-break-word text-[10px] text-destructive'>
              {error.stack || error.message}
            </pre>
          </div>
        )}

        <div className='flex gap-3'>
          <button
            onClick={() => reset()}
            className='flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
          >
            <RotateCcw className='size-4' />
            Réessayer
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className='flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent'
          >
            Accueil
          </button>
        </div>
      </div>
    </main>
  )
}
