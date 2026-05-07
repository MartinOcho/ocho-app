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

  const handleSend = () => {
    console.log('[VoiceRecorderDisplay] Send button clicked');
    onSend();
  };

  const handleStop = () => {
    console.log('[VoiceRecorderDisplay] Stop button clicked');
    onStop();
  };

  const handleCancel = () => {
    console.log('[VoiceRecorderDisplay] Cancel button clicked');
    onCancel();
  };

  return (
    <div className="flex items-center gap-2 bg-secondary dark:bg-secondary px-4 py-2 rounded-full w-full border-none outline-none">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-medium text-secondary-foreground dark:text-secondary-foreground whitespace-nowrap">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleCancel}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-secondary/80 dark:hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none"
          title="Annuler l'enregistrement"
          type="button"
        >
          <X className="h-5 w-5 text-secondary-foreground dark:text-secondary-foreground" />
        </button>

        <button
          onClick={handleStop}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none"
          title="Pause: garder l'enregistrement et pouvoir le reprendre"
          type="button"
        >
          <Square className="h-5 w-5 text-primary-foreground fill-primary-foreground" />
        </button>

        <button
          onClick={handleSend}
          disabled={isSending}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none"
          title="Envoyer la note vocale"
          type="button"
        >
          <Send className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}
