'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface UserProfile {
  id: string;
  displayName: string;
  avatar?: string;
}

interface VoiceNotePlayerProps {
  url: string;
  duration: number;
  className?: string;
  isSent?: boolean;
  user?: UserProfile;
}

export default function VoiceNotePlayer({
  url,
  duration,
  className,
  isSent = false,
  user,
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waveformBars] = useState<number[]>(
    Array.from({ length: 30 }, () => Math.random() * 100)
  );
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (isPlaying && audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isPlaying]);

  const initAudioContext = async () => {
    if (audioContextRef.current) return audioContextRef.current;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    return audioContext;
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          audioSourceRef.current = null;
        }
        setIsPlaying(false);
        setCurrentTime(0);
      } else {
        setIsLoading(true);
        const audioContext = await initAudioContext();

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch audio');

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        audioSourceRef.current = source;

        source.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };

        source.start(0, currentTime);
        setIsPlaying(true);
        setIsLoading(false);

        // Animation loop for time tracking
        const startTime = audioContext.currentTime - currentTime;
        const updateTime = () => {
          const elapsed = audioContext.currentTime - startTime;
          if (elapsed <= audioBuffer.duration) {
            setCurrentTime(elapsed);
            animationFrameRef.current = requestAnimationFrame(updateTime);
          } else {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        };

        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    } catch (error) {
      console.error('Erreur lors de la lecture:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const bgColor = isSent ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700';
  const textColor = isSent ? 'text-white' : 'text-gray-700 dark:text-gray-300';
  const waveBarColor = isSent ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500';
  const buttonBgColor = isSent
    ? 'bg-white/20 hover:bg-white/30'
    : 'bg-gray-300 dark:bg-gray-500 hover:bg-gray-400 dark:hover:bg-gray-600';
  const buttonTextColor = isSent ? 'text-white' : 'text-gray-700 dark:text-gray-300';

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-full', bgColor, className)}>
      {/* Avatar */}
      {user?.avatar && (
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
            <Image
              src={user.avatar}
              alt={user.displayName}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border border-white">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm1-7H9v4h2V9zm0-4H9v2h2V5z" />
            </svg>
          </div>
        </div>
      )}

      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0 transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          buttonBgColor,
          buttonTextColor
        )}
      >
        {isLoading ? (
          <div className={cn('h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin')} />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4" fill="currentColor" />
        )}
      </button>

      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-end gap-1 h-8">
          {waveformBars.map((bar, index) => {
            const isActive = (index / waveformBars.length) * 100 <= progressPercentage;
            return (
              <div
                key={index}
                className={cn(
                  'w-0.5 rounded-full transition-all cursor-pointer',
                  waveBarColor,
                  isActive ? 'opacity-100' : 'opacity-40'
                )}
                style={{
                  height: `${Math.max(8, bar * 0.6)}%`,
                }}
              />
            );
          })}
        </div>
        <span className={cn('text-sm font-medium whitespace-nowrap flex-shrink-0', textColor)}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
