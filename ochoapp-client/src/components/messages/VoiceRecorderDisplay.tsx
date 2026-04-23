'use client';

import { Square, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderDisplayProps {
  recordingTime: number;
  isSending: boolean;
  onCancel: () => void;
  onStop: () => void;
  onSend: () => void;
}

export function VoiceRecorderDisplay({
  recordingTime,
  isSending,
  onCancel,
  onStop,
  onSend,
}: VoiceRecorderDisplayProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 px-4 py-2 rounded-full w-full">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300 whitespace-nowrap">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
          title="Annuler l'enregistrement"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>

        <button
          onClick={onStop}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
          title="Arrêter l'enregistrement"
        >
          <Square className="h-5 w-5 text-white fill-white" />
        </button>

        <button
          onClick={onSend}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50"
          title="Envoyer la note vocale"
        >
          <Send className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}
