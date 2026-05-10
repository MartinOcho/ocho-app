'use client';

import { Loader2, AlertCircle, Mic } from 'lucide-react';
import { useSession } from '@/app/(main)/SessionProvider';
import { cn } from '@/lib/utils';
import UserAvatar from '../UserAvatar';

interface SendingVoiceNoteProps {
  tempId: string;
  progress?: number;
  status?: 'uploading' | 'sending' | 'sent' | 'error';
  error?: string;
  onRetry?: () => void;
}

export function SendingVoiceNote({
  tempId,
  progress = 0,
  status = 'uploading',
  error,
  onRetry,
}: SendingVoiceNoteProps) {
  const { user } = useSession();

  // Générer des waveform bars basées sur la progression
  const generateProgressBars = (progressPercent: number): number[] => {
    const bars = Array.from({ length: 35 }, (_, i) => {
      const barProgress = (i / 34) * 100;
      // Les bars remplissent progressivement selon la progression
      return barProgress <= progressPercent ? 10 : 5;
    });
    return bars;
  };

  const waveformBars = generateProgressBars(progress);

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return `${progress}%`;
      case 'sending':
        return 'Envoi...';
      case 'sent':
        return 'Envoyé';
      case 'error':
        return error || 'Erreur';
      default:
        return 'Envoi...';
    }
  };

  const bgColor =
    status === 'error'
      ? 'bg-red-100 dark:bg-red-950'
      : 'bg-blue-600 dark:bg-neutral-800';

  const textColor =
    status === 'error'
      ? 'text-red-800 dark:text-red-200'
      : 'text-white';

  const waveBarColor =
    status === 'error'
      ? 'bg-red-400 dark:bg-red-500'
      : 'bg-white';

  const buttonBgColor =
    status === 'error'
      ? 'bg-red-200/30 dark:bg-red-900/30'
      : 'bg-white/20 hover:bg-white/30';

  const buttonTextColor = status === 'error' ? 'text-red-800 dark:text-red-200' : 'text-white';

  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-hidden rounded-full px-3 py-2 max-sm:max-w-72 sm:gap-3 sm:px-4 sm:py-3',
        bgColor,
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white/20 sm:h-10 sm:w-10">
          <UserAvatar
            userId={user?.id || ''}
            avatarUrl={user?.avatarUrl}
            size={40}
            hideBadge={false}
          />
        </div>
        <div
          className={cn(
            'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white sm:h-5 sm:w-5',
            status === 'error' ? 'bg-red-500' : 'bg-blue-500'
          )}
        >
          {status === 'error' ? (
            <AlertCircle className="h-2 w-2 text-white sm:h-3 sm:w-3" />
          ) : (
            <Mic className="h-2 w-2 text-white sm:h-3 sm:w-3" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Loader ou statut */}
        <div
          className={cn(
            'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all sm:h-9 sm:w-9',
            buttonBgColor,
            buttonTextColor,
          )}
        >
          {status === 'uploading' || status === 'sending' ? (
            <div
              className={cn(
                'h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent sm:h-4 sm:w-4',
              )}
            />
          ) : status === 'error' ? (
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
          ) : (
            <Mic className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" />
          )}
        </div>

        {/* Zone Onde Sonore et Progression */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {/* Les waveform bars : utilisation de justify-between et d'espacements dynamiques */}
          <div className="flex h-8 flex-1 items-center justify-between gap-[1px] overflow-hidden sm:gap-1">
            {waveformBars.map((bar, index) => {
              const isActive = (index / Math.max(1, waveformBars.length - 1)) * 100 <= progress;
              return (
                <div
                  key={index}
                  className={cn(
                    'w-[1.5px] flex-shrink-0 rounded-full transition-all sm:w-0.5',
                    waveBarColor,
                    isActive ? 'opacity-100' : 'opacity-40',
                  )}
                  style={{
                    height: `${Math.max(8, bar * 0.6)}%`,
                  }}
                />
              );
            })}
          </div>

          {/* Affichage de la progression ou statut */}
          <span className={cn('flex-shrink-0 whitespace-nowrap text-xs font-medium sm:text-sm', textColor)}>
            {getStatusMessage()}
          </span>
        </div>
      </div>

      {/* Bouton Retry en cas d'erreur */}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 ml-2 text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
