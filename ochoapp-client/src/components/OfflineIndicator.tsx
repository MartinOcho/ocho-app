/**
 * Indicateur visuel offline
 * Affichage intelligente: seulement si vraiment offline
 * (pas de faux positifs si une requête échoue)
 */

'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { useOnline } from '@/hooks/useOnline'
import { useState, useEffect } from 'react'

interface OfflineIndicatorProps {
  /**
   * Délai avant affichage du message (ms)
   * Évite l'affichage de faux positifs rapidement disparaissants
   */
  delay?: number
  /**
   * Position du toast
   */
  position?: 'top' | 'bottom'
}

export function OfflineIndicator({
  delay = 1000,
  position = 'bottom',
}: OfflineIndicatorProps) {
  const isOnline = useOnline()
  const [shouldShow, setShouldShow] = useState(false)
  const [wasOnline, setWasOnline] = useState(true)

  useEffect(() => {
    // Seulement afficher si c'est une transition de online à offline
    if (!isOnline && wasOnline) {
      const timer = setTimeout(() => {
        setShouldShow(true)
      }, delay)

      return () => clearTimeout(timer)
    }

    // Masquer quand revient online
    if (isOnline && !wasOnline) {
      setShouldShow(false)
      setWasOnline(true)
    } else if (!isOnline) {
      setWasOnline(false)
    }
  }, [isOnline, wasOnline, delay])

  if (isOnline || !shouldShow) {
    return null
  }

  const positionClass = position === 'top' ? 'top-4' : 'bottom-4'

  return (
    <div
      className={`fixed ${positionClass} left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-2`}
    >
      <div className='flex items-center gap-3 rounded-full border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-md backdrop-blur-sm'>
        <WifiOff className='size-4 animate-pulse' />
        <span className='font-medium'>
          Pas de connexion internet
        </span>
      </div>
    </div>
  )
}

/**
 * Badge compact pour header/navbar
 */
export function OfflineBadge() {
  const isOnline = useOnline()

  if (isOnline) {
    return null
  }

  return (
    <div className='inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive'>
      <WifiOff className='size-3' />
      Offline
    </div>
  )
}

/**
 * Status détaillé pour debugging
 */
export function OnlineStatus() {
  const isOnline = useOnline()

  return (
    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
      {isOnline ? (
        <>
          <Wifi className='size-3 text-green-500' />
          <span>Connecté</span>
        </>
      ) : (
        <>
          <WifiOff className='size-3 text-destructive animate-pulse' />
          <span>Offline</span>
        </>
      )}
    </div>
  )
}
