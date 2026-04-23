'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/components/providers/SocketProvider';
import { useSession } from '@/app/(main)/SessionProvider';
import { useToast } from '@/components/ui/use-toast';

interface VoiceRecorderProps {
  roomId: string;
  disabled?: boolean;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onVoiceNoteSent?: () => void;
  isRecording?: boolean;
  recordingTime?: number;
}

export const useVoiceRecorder = (roomId: string, onVoiceNoteSent?: () => void) => {
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
          socket.emit('recording_status', {
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
      console.error('Erreur lors de l\'accès au microphone:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'accéder au microphone. Vérifiez les permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Arrêter tous les flux audio
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      // Émettre le statut d'arrêt d'enregistrement
      if (socket && user) {
        socket.emit('recording_status', {
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
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;

        socket.emit('send_voice_note', {
          voiceNoteBase64: base64String,
          duration: recordingTime,
          roomId,
          tempId: `temp-${Date.now()}`,
        });

        // Réinitialiser l'enregistrement
        audioChunksRef.current = [];
        setRecordingTime(0);
        setIsSending(false);

        toast({
          title: 'Succès',
          description: 'Note vocale envoyée.',
        });
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la note vocale:', error);
      setIsSending(false);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'envoi de la note vocale.',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <button
        onClick={startRecording}
        disabled={disabled || isSending}
        className={cn(
          'inline-flex items-center justify-center h-10 w-10 rounded-full',
          'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Enregistrer une note vocale"
      >
        <Mic className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-full">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300 whitespace-nowrap">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={cancelRecording}
          disabled={isSending}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors disabled:opacity-50"
          title="Annuler l'enregistrement"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>

        <button
          onClick={stopRecording}
          disabled={isSending}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
          title="Arrêter l'enregistrement"
        >
          <Square className="h-4 w-4 text-white fill-white" />
        </button>

        {recordingTime > 0 && !isRecording && (
          <button
            onClick={sendVoiceNote}
            disabled={isSending}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50"
            title="Envoyer la note vocale"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
