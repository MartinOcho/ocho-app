/**
 * Wrapper sécurisé pour les requêtes Prisma côté serveur
 * Empêche les requêtes Prisma de crasher l'app si la DB est offline
 */

export interface SafeQueryResult<T> {
  data: T | null
  error: Error | null
  isDbOffline: boolean
}

/**
 * Wrapper générique pour les requêtes Prisma
 * Capture toutes les erreurs et les log
 *
 * @example
 * const user = await safeQuery(
 *   () => prisma.user.findUnique({ where: { id } })
 * )
 *
 * if (!user.data) {
 *   return { error: user.error?.message }
 * }
 */
export async function safeQuery<T>(
  fn: () => Promise<T>
): Promise<SafeQueryResult<T>> {
  try {
    const data = await fn()
    return {
      data,
      error: null,
      isDbOffline: false,
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))

    // Détect les erreurs Prisma spécifiques
    const isDbOffline =
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('EHOSTUNREACH') ||
      error.message.includes('getaddrinfo') ||
      error.message.includes('Connection pool') ||
      (error as any).code === 'P1000' || // Network error
      (error as any).code === 'P1001' || // Can't reach DB server
      (error as any).code === 'P1008' || // Operation timeout
      (error as any).code === 'P1011' // Error in the connector

    // Log l'erreur pour monitoring
    if (process.env.NODE_ENV === 'development') {
      console.error('[safeQuery] Error:', {
        message: error.message,
        isDbOffline,
        code: (error as any).code,
        stack: error.stack,
      })
    }

    return {
      data: null,
      error,
      isDbOffline,
    }
  }
}

/**
 * Wrapper avec fallback: retourne les données ou une valeur default
 */
export async function safeQueryWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  const result = await safeQuery(fn)
  return result.data ?? fallback
}

/**
 * Wrapper pour les mutations (create, update, delete)
 * Utile pour valider les données avant de persister
 */
export async function safeMutation<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<SafeQueryResult<T>> {
  const result = await safeQuery(fn)

  if (result.error && onError) {
    onError(result.error)
  }

  return result
}
