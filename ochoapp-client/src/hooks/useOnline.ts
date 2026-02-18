/**
 * Hook pour détecter l'état online/offline
 * Met à jour automatiquement quand l'état réseau change
 */

'use client'

import { useEffect, useState } from 'react'

export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    // Vérifier que nous sommes en client
    if (typeof window === 'undefined') {
      return true // Assume online côté serveur
    }
    return navigator.onLine ?? true
  })

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log('[useOnline] Connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('[useOnline] Connection lost')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Hook pour écouter les changements de connexion
 */
export function useOnlineChange(callback: (isOnline: boolean) => void) {
  const isOnline = useOnline()

  useEffect(() => {
    callback(isOnline)
  }, [isOnline, callback])
}
