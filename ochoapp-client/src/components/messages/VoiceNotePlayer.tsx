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

  const bgColor = isSent ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700";
  const textColor = isSent ? "text-white" : "text-gray-700 dark:text-gray-300";
  const waveBarColor = isSent ? "bg-white" : "bg-gray-400 dark:bg-gray-500";
  const buttonBgColor = isSent
    ? "bg-white/20 hover:bg-white/30"
    : "bg-gray-300 dark:bg-gray-500 hover:bg-gray-400 dark:hover:bg-gray-600";
  const buttonTextColor = isSent
    ? "text-white"
    : "text-gray-700 dark:text-gray-300";

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-hidden rounded-full px-3 py-2 max-sm:max-w-60 sm:gap-3 sm:px-4 sm:py-3",
        bgColor,
        !isSent && "flex-row-reverse",
        className,
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white/20 sm:h-10 sm:w-10">
          <UserAvatar
            userId={""}
            avatarUrl={user.avatarUrl}
            size={40}
            hideBadge={false}
          />
        </div>
        <div className={cn("absolute -bottom-1  flex h-4 w-4 items-center justify-center rounded-full border border-white bg-blue-500 sm:h-5 sm:w-5", isSent ? "-right-1" : "-left-1")}>
          <Mic className="h-2 w-2 text-white sm:h-3 sm:w-3" />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bouton Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className={cn(
            "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all sm:h-9 sm:w-9",
            "disabled:cursor-not-allowed disabled:opacity-50",
            buttonBgColor,
            buttonTextColor,
          )}
        >
          {isLoading ? (
            <div
              className={cn(
                "h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent sm:h-4 sm:w-4",
              )}
            />
          ) : isPlaying ? (
            <Pause className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" />
          ) : (
            <Play className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" />
          )}
        </button>

        {/* Zone Onde Sonore et Temps */}
        {/* L'ajout de min-w-0 ici est crucial pour éviter que ce conteneur flex ne force la largeur de son parent */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {/* L'onde sonore : utilisation de justify-between et d'espacements dynamiques */}
          <div className="flex h-8 flex-1 items-center justify-between gap-[1px] overflow-hidden sm:gap-1">
            {waveformBars.map((bar, index) => {
              const isActive =
                (index / waveformBars.length) * 100 <= progressPercentage;
              return (
                <div
                  key={index}
                  className={cn(
                    "w-[1.5px] flex-shrink-0 rounded-full transition-all sm:w-0.5",
                    waveBarColor,
                    isActive ? "opacity-100" : "opacity-40",
                  )}
                  style={{
                    height: `${Math.max(8, bar * 0.6)}%`,
                  }}
                />
              );
            })}
          </div>

          {/* Temps restant/écoulé */}
          <span
            className={cn(
              "flex-shrink-0 whitespace-nowrap text-xs font-medium sm:text-sm",
              textColor,
            )}
          >
            {formatTime(isPlaying ? currentTime : duration)}
          </span>
        </div>
      </div>
    </div>
  );
}