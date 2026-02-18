/**
 * Hook pour les Server Actions avec gestion d'erreur intelligente
 * Gère loading, erreurs, réussite automatiquement
 */

'use client'

import { useState, useCallback } from 'react'
import { useOnline } from '@/hooks/useOnline'

export interface ServerActionState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  isOffline: boolean
}

/**
 * Hook pour exécuter une Server Action
 *
 * @example
 * const { execute, data, error, isLoading } = useServerAction(updateUserAction)
 *
 * const handleSubmit = async (formData) => {
 *   const result = await execute(formData)
 *   if (result?.success) {
 *     toast.success('Profil mis à jour')
 *   }
 * }
 */
export function useServerAction<T, A extends any[]>(
  action: (...args: A) => Promise<T>
) {
  const [state, setState] = useState<ServerActionState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isOffline: false,
  })

  const isOnline = useOnline()

  const execute = useCallback(
    async (...args: A) => {
      // Check offline
      if (!isOnline) {
        setState({
          data: null,
          error: 'Pas de connexion internet',
          isLoading: false,
          isOffline: true,
        })
        return null
      }

      setState({
        data: null,
        error: null,
        isLoading: true,
        isOffline: false,
      })

      try {
        const result = await action(...args)

        setState({
          data: result,
          error: null,
          isLoading: false,
          isOffline: false,
        })

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Une erreur est survenue'

        setState({
          data: null,
          error: errorMessage,
          isLoading: false,
          isOffline: false,
        })

        return null
      }
    },
    [action, isOnline]
  )

  return {
    execute,
    ...state,
  }
}

/**
 * Hook pour les Server Actions avec réussite confirmée
 */
export function useServerActionWithSuccess<T, A extends any[]>(
  action: (...args: A) => Promise<{ success: boolean; error?: string; data?: T }>
) {
  const [state, setState] = useState<ServerActionState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isOffline: false,
  })

  const isOnline = useOnline()

  const execute = useCallback(
    async (...args: A) => {
      if (!isOnline) {
        setState({
          data: null,
          error: 'Pas de connexion internet',
          isLoading: false,
          isOffline: true,
        })
        return { success: false, error: 'Offline' }
      }

      setState({
        data: null,
        error: null,
        isLoading: true,
        isOffline: false,
      })

      try {
        const result = await action(...args)

        if (result.success) {
          setState({
            data: result.data ?? null,
            error: null,
            isLoading: false,
            isOffline: false,
          })
          return { success: true, data: result.data }
        } else {
          setState({
            data: null,
            error: result.error ?? 'Une erreur est survenue',
            isLoading: false,
            isOffline: false,
          })
          return { success: false, error: result.error }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Une erreur est survenue'

        setState({
          data: null,
          error: errorMessage,
          isLoading: false,
          isOffline: false,
        })

        return { success: false, error: errorMessage }
      }
    },
    [action, isOnline]
  )

  return {
    execute,
    ...state,
  }
}
