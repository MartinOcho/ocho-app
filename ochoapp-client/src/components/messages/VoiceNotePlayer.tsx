"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import UserAvatar from "../UserAvatar";

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface VoiceNotePlayerProps {
  url: string;
  duration: number;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waveformBars] = useState<number[]>(
    Array.from({ length: 30 }, () => Math.random() * 100),
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

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
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
        if (!response.ok) throw new Error("Failed to fetch audio");

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

        // Boucle d'animation pour le suivi du temps
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
      console.error("Erreur lors de la lecture:", error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

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
        "flex items-center gap-2 sm:gap-3 rounded-full px-3 sm:px-4 py-2 sm:py-3 max-sm:max-w-60 overflow-hidden",
        bgColor,
        className,
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-full border-2 border-white/20">
          <UserAvatar
            userId={""}
            avatarUrl={user.avatarUrl}
            size={40}
            hideBadge={false}
          />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-white bg-blue-500">
          <Mic className="h-2 w-2 sm:h-3 sm:w-3 text-white" />
        </div>
      </div>

      {/* Bouton Play/Pause */}
      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        className={cn(
          "inline-flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full transition-all",
          "disabled:cursor-not-allowed disabled:opacity-50",
          buttonBgColor,
          buttonTextColor,
        )}
      >
        {isLoading ? (
          <div
            className={cn(
              "h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
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
      <div className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
        {/* L'onde sonore : utilisation de justify-between et d'espacements dynamiques */}
        <div className="flex h-8 flex-1 items-center justify-between gap-[1px] sm:gap-1 overflow-hidden">
          {waveformBars.map((bar, index) => {
            const isActive =
              (index / waveformBars.length) * 100 <= progressPercentage;
            return (
              <div
                key={index}
                className={cn(
                  "w-[1.5px] sm:w-0.5 flex-shrink-0 rounded-full transition-all",
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
            "flex-shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium",
            textColor,
          )}
        >
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}