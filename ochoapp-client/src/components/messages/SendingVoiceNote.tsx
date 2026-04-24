'use client';

import { Loader2, AlertCircle, Mic } from 'lucide-react';
import { useSession } from '@/app/(main)/SessionProvider';
import { cn } from '@/lib/utils';

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

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return `Upload en cours... ${progress}%`;
      case 'sending':
        return 'Envoi du message...';
      case 'sent':
        return 'Envoyé';
      case 'error':
        return error || 'Erreur lors de l\'envoi';
      default:
        return 'Envoi...';
    }
  };

  const getProgressDisplay = () => {
    if (status === 'uploading') {
      return `${progress}%`;
    } else if (status === 'sending') {
      return '95%';
    }
    return null;
  };

  return (
    <div className="flex items-start gap-3 pr-2">
      <div className="flex-1 flex flex-col gap-1">
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full max-w-xs',
            status === 'error'
              ? 'bg-red-100 dark:bg-red-950'
              : 'bg-blue-100 dark:bg-blue-950'
          )}
        >
          <Mic className="h-4 w-4 flex-shrink-0" />
          <span
            className={cn(
              'text-sm font-medium',
              status === 'error'
                ? 'text-red-700 dark:text-red-300'
                : 'text-blue-700 dark:text-blue-300'
            )}
          >
            Note vocale
          </span>
        </div>

        {/* Barre de progression */}
        {status === 'uploading' || status === 'sending' ? (
          <div className="flex items-center gap-2 px-4">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{
                  width: `${status === 'uploading' ? progress : 95}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-fit">
              {getProgressDisplay()}
            </span>
          </div>
        ) : null}

        {/* Message de statut */}
        <div className="flex items-center gap-2 px-4">
          {status === 'uploading' || status === 'sending' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {getStatusMessage()}
              </span>
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400">
                {getStatusMessage()}
              </span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline ml-auto"
                >
                  Réessayer
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Avatar utilisateur */}
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="h-8 w-8 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
      )}
    </div>
  );
}
