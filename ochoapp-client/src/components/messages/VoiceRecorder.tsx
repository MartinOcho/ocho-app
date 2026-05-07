"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/components/providers/SocketProvider";
import { useSession } from "@/app/(main)/SessionProvider";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "../ui/button";
import kyInstance from "@/lib/ky";

interface VoiceRecorderProps {
  roomId: string;
  disabled?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onVoiceNoteSent?: () => void;
  isRecording?: boolean;
  recordingTime?: number;
}

export const useVoiceRecorder = (
  roomId: string,
  onVoiceNoteSent?: () => void,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { socket } = useSocket();
  const { user } = useSession();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);

        // Émettre le statut d'enregistrement
        if (socket && user) {
          socket.emit("recording_status", {
            roomId,
            isRecording: true,
            userId: user.id,
          });
        }

        // Démarrer le chronomètre
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Erreur lors de l'accès au microphone:", error);
      toast({
        title: "Erreur",
        description:
          "Impossible d'accéder au microphone. Vérifiez les permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      // Arrêter tous les flux audio
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      // Émettre le statut d'arrêt d'enregistrement
      if (socket && user) {
        socket.emit("recording_status", {
          roomId,
          isRecording: false,
          userId: user.id,
        });
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Redémarrer le chronomètre
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    audioChunksRef.current = [];
    setRecordingTime(0);
    setIsPaused(false);
  };

  const applyNoiseReduction = async (
    audioBlob: Blob,
  ): Promise<Blob> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Décoder l'audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const { length, sampleRate, numberOfChannels } = audioBuffer;

      // Créer un buffer de sortie
      const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        length,
        sampleRate,
      );

      // Créer la source audio
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      // Créer un filtre high-pass pour éliminer les bruits de basse fréquence
      const filter = offlineContext.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 80; // Fréquence de coupure à 80 Hz
      filter.Q.value = 0.5;

      // Créer un analyseur pour obtenir les données d'ampleur
      const analyser = offlineContext.createAnalyser();

      // Connecter la source au filtre puis au nœud de destination
      source.connect(filter);
      filter.connect(analyser);
      analyser.connect(offlineContext.destination);

      // Lancer l'enregistrement hors ligne
      source.start(0);
      const processedBuffer = await offlineContext.startRendering();

      // Convertir le buffer traité en blob
      const wavData = encodeWAV(processedBuffer, sampleRate);
      return new Blob([wavData], { type: "audio/wav" });
    } catch (error) {
      console.error("Erreur lors de la suppression du bruit:", error);
      // Retourner le blob original en cas d'erreur
      return audioBlob;
    }
  };

  const encodeWAV = (
    audioBuffer: AudioBuffer,
    sampleRate: number,
  ): ArrayBuffer => {
    const length = audioBuffer.length * audioBuffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];

    // Récupérer les données de chaque canal
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    // Écrire le header WAV
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + audioBuffer.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, audioBuffer.numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2 * audioBuffer.numberOfChannels, true);
    view.setUint16(32, audioBuffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true); // bits par sample
    writeString(36, "data");
    view.setUint32(40, audioBuffer.length * 2, true);

    // Écrire les données audio
    let offset = 44;
    let volume = 0.8; // Réduire légèrement le volume

    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, channels[channel][i] * volume),
        );
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true,
        );
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  const sendVoiceNote = async () => {
    if (audioChunksRef.current.length === 0 || !socket || !user) return;

    setIsSending(true);

    try {
      let audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      // Appliquer la suppression de bruit
      audioBlob = await applyNoiseReduction(audioBlob);

      // 1. Upload le fichier audio à l'API pour générer les waves
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice_note.wav");
      formData.append("duration", recordingTime.toString());
      formData.append("sessionId", user.id); // Utiliser l'ID utilisateur comme session pour maintenant

      const uploadResponse = await kyInstance("/api/voicenotes/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Erreur lors de l'upload de la note vocale");
      }

      const uploadData = await uploadResponse.json<{
        success: boolean,
        voiceNoteId: string | null,
        error: string | null
      }>();

      if (!uploadData.success || !uploadData.voiceNoteId) {
        throw new Error(
          uploadData.error || "Erreur lors de la création de la note vocale",
        );
      }

      // 2. Envoyer le voiceNoteId au socket pour créer le message
      socket.emit("send_voice_note", {
        voiceNoteId: uploadData.voiceNoteId,
        roomId,
        tempId: `temp-${Date.now()}`,
      });

      // Réinitialiser l'enregistrement
      audioChunksRef.current = [];
      setRecordingTime(0);
      setIsSending(false);

      toast({
        title: "Succès",
        description: "Note vocale envoyée.",
      });

      onVoiceNoteSent?.();
    } catch (error) {
      console.error("Erreur lors de l'envoi de la note vocale:", error);
      setIsSending(false);
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'envoi de la note vocale.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isRecording) {
    return (
      <button
        onClick={startRecording}
        disabled={isSending}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full",
          "transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        title="Enregistrer une note vocale"
      >
        <Mic className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border-none bg-secondary px-3 py-2 outline-none dark:bg-secondary">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className={cn(
          "h-2 w-2 rounded-full",
          isPaused ? "bg-yellow-500" : "animate-pulse bg-destructive"
        )} />
        <span className="whitespace-nowrap text-sm font-medium text-secondary-foreground dark:text-secondary-foreground">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          onClick={cancelRecording}
          size="icon"
          disabled={isSending}
          variant="ghost"
          title="Annuler l'enregistrement"
        >
          <X className="h-4 w-4 text-secondary-foreground dark:text-secondary-foreground" />
        </Button>

        {!isPaused ? (
          <Button
            onClick={pauseRecording}
            disabled={isSending}
            size="icon"
            variant="default"
            title="Mettre en pause"
          >
            <div className="h-4 w-4 flex items-center justify-center gap-1">
              <div className="h-3 w-1 bg-white rounded-sm" />
              <div className="h-3 w-1 bg-white rounded-sm" />
            </div>
          </Button>
        ) : (
          <Button
            onClick={resumeRecording}
            disabled={isSending}
            size="icon"
            variant="default"
            title="Reprendre l'enregistrement"
          >
            <svg 
              className="h-4 w-4 fill-white" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </Button>
        )}

        <Button
          onClick={stopRecording}
          disabled={isSending}
          size="icon"
          variant="destructive"
          title="Arrêter l'enregistrement"
        >
          <Square className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
        </Button>

        <Button
          onClick={sendVoiceNote}
          disabled={recordingTime > 0 && !isRecording && isSending}
          size="icon"
          variant={recordingTime > 0 && !isRecording ? "secondary" : "default"}
          title="Envoyer la note vocale"
        >
          <Send className="h-4 w-4 text-white" />
        </Button>
      </div>
    </div>
  );
};
