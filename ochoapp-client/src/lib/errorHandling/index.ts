/**
 * 🎯 INDEX D'IMPORTS - Error Handling & Offline
 * 
 * Utiliser ce fichier pour centraliser tous les imports
 * Simplifie les imports dans les composants
 */

// ============================================================================
// HOOKS
// ============================================================================

export { useOnline, useOnlineChange } from '@/hooks/useOnline'
export { useSafeFetch, useSafeMutation } from '@/hooks/useSafeFetch'
export { useServerAction, useServerActionWithSuccess } from '@/hooks/useServerAction'

// ============================================================================
// COMPOSANTS
// ============================================================================

export {
  OfflineIndicator,
  OfflineBadge,
  OnlineStatus,
} from '@/components/OfflineIndicator'

// ============================================================================
// UTILITAIRES FETCH
// ============================================================================

export {
  safeFetch,
  isOnline,
  checkApiHealth,
  type SafeFetchResponse,
} from '@/lib/safeFetch'

// ============================================================================
// UTILITAIRES QUERYS
// ============================================================================

export {
  safeQuery,
  safeQueryWithFallback,
  safeMutation,
  type SafeQueryResult,
} from '@/lib/safeQuery'

// ============================================================================
// EXEMPLES D'UTILISATION
// ============================================================================

/*
import {
  // Hooks
  useOnline,
  useSafeFetch,
  useServerAction,
  
  // Composants
  OfflineIndicator,
  OfflineBadge,
  OnlineStatus,
  
  // Fonctions
  safeFetch,
  safeQuery,
} from '@/lib/errorHandling'

// Exemple 1: Récupérer des données
function MyComponent() {
  const { data, error, isLoading } = useSafeFetch('/api/data')
  return error ? <Error /> : <Data data={data} />
}

// Exemple 2: Server Action
'use server'
function MyAction() {
  const { execute, error, isLoading } = useServerAction(myAction)
}

// Exemple 3: Détection offline
function MyComponent() {
  const isOnline = useOnline()
  return isOnline ? <Online /> : <Offline />
}

// Exemple 4: Fetch manuel
const result = await safeFetch('/api/data')
if (result.isOffline) console.log('Offline!')

// Exemple 5: Prisma côté serveur
const result = await safeQuery(() => 
  prisma.user.findUnique(...)
)
if (result.isDbOffline) return 503
*/
