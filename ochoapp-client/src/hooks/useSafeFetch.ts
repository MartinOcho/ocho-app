/**
 * Hook pour interroger les API avec résilience offline
 * Combine React Query + safeFetch pour une UX robuste
 */

'use client'

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { safeFetch, SafeFetchResponse, isOnline } from '@/lib/safeFetch'
import { useOnline } from '@/hooks/useOnline'

export interface UseSafeFetchOptions<T>
  extends Omit<UseQueryOptions<SafeFetchResponse<T>>, 'queryKey' | 'queryFn'> {
  timeout?: number
}

/**
 * Hook pour interroger les API intelligemment
 *
 * @example
 * const { data, error, isLoading } = useSafeFetch<User>(
 *   '/api/user',
 *   { staleTime: 5 * 60 * 1000 }
 * )
 *
 * if (error) return <ErrorMessage error={error.error} />
 * if (isLoading) return <Skeleton />
 * return <UserCard user={data} />
 */
export function useSafeFetch<T = unknown>(
  url: string | null,
  options?: UseSafeFetchOptions<T>
) {
  const isClientOnline = useOnline()

  const query = useQuery({
    queryKey: [url],
    queryFn: async () => {
      if (!url) throw new Error('URL is required')
      return safeFetch<T>(url, { timeout: options?.timeout })
    },
    enabled: !!url && isClientOnline, // Désactiver la query si offline
    ...options,
  })

  return {
    ...query,
    data: query.data?.data,
    error: query.data?.error,
    isOffline: query.data?.isOffline ?? !isClientOnline,
  }
}

/**
 * Hook pour les mutations HTTP sécurisées
 */
export function useSafeMutation<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  const isClientOnline = useOnline()

  return {
    mutate: async (data?: unknown) => {
      if (!isClientOnline) {
        return {
          error: { type: 'network' as const, message: 'Pas de connexion' },
          isOffline: true,
        }
      }

      return safeFetch<T>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      })
    },
    isOffline: !isClientOnline,
  }
}
