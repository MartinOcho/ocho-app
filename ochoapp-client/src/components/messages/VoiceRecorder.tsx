"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/components/providers/SocketProvider";
import { useSession } from "@/app/(main)/SessionProvider";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "../ui/button";

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
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
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

      // Arrêter tous les flux audio
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());

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

  const cancelRecording = () => {
    stopRecording();
    audioChunksRef.current = [];
    setRecordingTime(0);
  };

  const sendVoiceNote = async () => {
    if (audioChunksRef.current.length === 0 || !socket || !user) return;

    setIsSending(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      // 1. Upload le fichier audio à l'API pour générer les waves
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice_note.webm");
      formData.append("duration", recordingTime.toString());
      formData.append("sessionId", user.id); // Utiliser l'ID utilisateur comme session pour maintenant

      const uploadResponse = await fetch("/api/voicenotes/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Erreur lors de l'upload de la note vocale");
      }

      const uploadData = await uploadResponse.json();

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
        <div className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
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
