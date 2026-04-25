"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import UserAvatar from "../UserAvatar";

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface VoiceNotePlayerProps {
  url: string;
  duration: number; // en secondes
  className?: string;
  isSent: boolean;
  user: UserProfile;
}

export default function VoiceNotePlayer({
  url,
  duration,
  className,
  isSent,
  user,
}: VoiceNotePlayerProps) {
  // --- États ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- Références ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Génération des barres une seule fois
  const [waveformBars] = useState<number[]>(() =>
    Array.from({ length: 35 }, () => Math.random() * 100)
  );

  // --- Nettoyage à la destruction du composant ---
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // --- Initialisation du Contexte ---
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
    }
    
    // Sur certains navigateurs, le contexte est suspendu par défaut
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // --- Fonction de mise à jour de la progression ---
  const startProgressLoop = (audioContext: AudioContext, bufferDuration: number) => {
    const update = () => {
      if (!audioContext) return;
      
      const now = audioContext.currentTime;
      const elapsed = now - startTimeRef.current;

      if (elapsed < bufferDuration) {
        setCurrentTime(elapsed);
        animationFrameRef.current = requestAnimationFrame(update);
      } else {
        // Fin naturelle
        handleStop();
      }
    };
    animationFrameRef.current = requestAnimationFrame(update);
  };

  const handleStop = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      handleStop();
      return;
    }

    try {
      setIsLoading(true);
      const audioContext = await initAudioContext();

      // Fetch et décodage
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Configuration de la source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      audioSourceRef.current = source;
      
      // On enregistre le moment exact du début dans le référentiel du contexte
      startTimeRef.current = audioContext.currentTime;
      
      source.start(0);
      setIsPlaying(true);
      setIsLoading(false);

      // Lancement de la boucle de rafraîchissement UI
      startProgressLoop(audioContext, audioBuffer.duration);

      source.onended = () => {
        // On vérifie si c'est une fin naturelle (pas un stop manuel)
        if (audioSourceRef.current === source) {
           handleStop();
        }
      };

    } catch (error) {
      console.error("Playback Error:", error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // --- Helpers UI ---
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = (currentTime / (duration || 1)) * 100;

  const styles = {
    bg: isSent ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-800",
    text: isSent ? "text-white" : "text-gray-700 dark:text-gray-300",
    bar: isSent ? "bg-white" : "bg-gray-400 dark:bg-gray-500",
    btn: isSent ? "bg-white/20 hover:bg-white/30" : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-2 w-fit min-w-[240px]", styles.bg, className)}>
      {/* Avatar Section */}
      <div className="relative flex-shrink-0">
        <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={32} />
        <div className="absolute -right-1 -bottom-1 bg-blue-600 rounded-full p-0.5 border border-white">
          <Mic className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Controls & Waveform */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", styles.btn)}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="flex flex-1 items-center justify-between h-6 gap-[2px]">
            {waveformBars.map((bar, i) => {
              const barProgress = (i / waveformBars.length) * 100;
              const isPlayed = barProgress <= progressPercentage;
              return (
                <div
                  key={i}
                  className={cn("w-1 rounded-full transition-opacity duration-200", styles.bar)}
                  style={{ 
                    height: `${Math.max(20, bar)}%`,
                    opacity: isPlayed ? 1 : 0.3
                  }}
                />
              );
            })}
          </div>
          
          <span className={cn("text-[11px] font-mono tabular-nums w-9", styles.text)}>
            {formatTime(isPlaying ? currentTime : duration)}
          </span>
        </div>
      </div>
    </div>
  );
}