'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  url: string;
  duration: number;
  className?: string;
}

export default function VoiceNotePlayer({
  url,
  duration,
  className,
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current.play().catch((error) => {
        console.error('Erreur lors de la lecture:', error);
        setIsLoading(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    if (audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error('Erreur lors de la lecture:', error);
      });
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `voice-note-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg', className)}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
        className="hidden"
      />

      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0',
          'hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isPlaying ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
          isPlaying && 'text-white'
        )}
      >
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-5 w-5" fill="currentColor" />
        ) : (
          <Play className="h-5 w-5" fill="currentColor" />
        )}
      </button>

      <div className="flex-1 min-w-40">
        <div className="w-full bg-gray-300 dark:bg-gray-600 h-1 rounded-full overflow-hidden cursor-pointer group">
          <div
            className={cn("bg-blue-500 h-full transition-all group-hover:bg-blue-600", `w-[${progressPercentage}%]`)}
            onClick={(e) => {
              if (!audioRef.current || !duration) return;
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (rect) {
                const percentage = (e.clientX - rect.left) / rect.width;
                audioRef.current.currentTime = percentage * duration;
              }
            }}
          />
        </div>
        <div className="flex justify-between items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        title="Télécharger" 
      >
        <Download className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
}
