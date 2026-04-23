'use client';

import { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/components/providers/SocketProvider';
import { useSession } from '@/app/(main)/SessionProvider';
import { useToast } from '@/components/ui/use-toast';

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
        setIsRecording(false);

        onVoiceNoteSent?.();

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

  return {
    isRecording,
    recordingTime,
    isSending,
    startRecording,
    stopRecording,
    cancelRecording,
    sendVoiceNote,
  };
};
