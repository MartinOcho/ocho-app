/**
 * Wrapper sécurisé pour les requêtes fetch
 * Gère offline, timeouts, erreurs réseau, 4xx/5xx
 */

import kyInstance from "./ky"

export interface SafeFetchResponse<T> {
  data?: T
  error?: {
    type: 'network' | 'timeout' | 'client' | 'server' | 'unknown'
    message: string
    status?: number
  }
  isOffline: boolean
}

/**
 * Détecte si l'app est offline
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

/**
 * Fetch sécurisé avec gestion offline/timeouts/erreurs
 */
export async function safeFetch<T = unknown>(
  url: string,
  options?: RequestInit & { timeout?: number }
): Promise<SafeFetchResponse<T>> {
  const timeout = options?.timeout ?? 10000

  // Vérifier offline d'abord
  if (!isOnline()) {
    return {
      isOffline: true,
      error: {
        type: 'network',
        message: 'Aucune connexion internet',
      },
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await kyInstance(url, {
      ...options,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Erreur client (4xx)
    if (response.status >= 400 && response.status < 500) {
      return {
        isOffline: false,
        error: {
          type: 'client',
          message: `Erreur client: ${response.statusText}`,
          status: response.status,
        },
      }
    }

    // Erreur serveur (5xx)
    if (response.status >= 500) {
      return {
        isOffline: false,
        error: {
          type: 'server',
          message: `Service temporairement indisponible`,
          status: response.status,
        },
      }
    }

    // Succès
    const data = await response.json()
    return {
      data: data as T,
      isOffline: false,
    }
  } catch (err) {
    // Timeout
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        isOffline: false,
        error: {
          type: 'timeout',
          message: 'La requête a expiré',
        },
      }
    }

    // Erreur réseau
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        isOffline: !isOnline(),
        error: {
          type: isOnline() ? 'network' : 'network',
          message: isOnline()
            ? 'Erreur de connexion'
            : 'Pas de connexion internet',
        },
      }
    }

    // Erreur inconnue
    return {
      isOffline: false,
      error: {
        type: 'unknown',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      },
    }
  }
}

/**
 * Helper: vérifier la santé de l'API
 * Appelé avant les requêtes importantes
 */
export async function checkApiHealth(
  apiUrl: string = process.env.NEXT_PUBLIC_API_URL || '/api'
): Promise<boolean> {
  const response = await safeFetch(`${apiUrl}/health`, {
    timeout: 5000,
    cache: 'no-store',
  })

  return !response.error && !response.isOffline
}
