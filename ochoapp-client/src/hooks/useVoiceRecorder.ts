'use client';

import { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/components/providers/SocketProvider';
import { useSession } from '@/app/(main)/SessionProvider';
import { useToast } from '@/components/ui/use-toast';

export const useVoiceRecorder = (
  roomId: string, 
  onVoiceNoteSent?: () => void,
  onSendingStart?: (tempId: string) => void
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { socket } = useSocket();
  const { user, session } = useSession();
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
        console.log('[VoiceRecorder] Data available:', event.data.size);
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);

        // Émettre le statut d'enregistrement
        if (socket && user && roomId) {
          console.log('[VoiceRecorder] Recording started, emitting recording_start for room:', roomId);
          socket.emit('recording_start', roomId);
        } else {
          console.warn('[VoiceRecorder] Cannot emit recording_start:', { socket: !!socket, user: !!user, roomId });
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
      if (socket && user && roomId) {
        console.log('[VoiceRecorder] Recording stopped, emitting recording_stop for room:', roomId);
        socket.emit('recording_stop', roomId);
      }
      
      console.log('[VoiceRecorder] Recording paused');
    }
  };

  const cancelRecording = () => {
    stopRecording();
    audioChunksRef.current = [];
    setRecordingTime(0);
    setIsRecording(false);
    console.log('[VoiceRecorder] Recording cancelled and cleared');
  };

  const sendVoiceNote = async () => {
    if (!mediaRecorderRef.current || !isRecording) {
      console.warn('[VoiceRecorder] Cannot send: recorder not ready or not recording');
      return;
    }

    if (!socket || !user || !session) {
      console.warn('[VoiceRecorder] Cannot send: socket, user or session missing');
      return;
    }

    console.log('[VoiceRecorder] sendVoiceNote called, stopping recorder...');
    setIsSending(true);

    // Retourner une promesse qui se résout quand onstop est appelé
    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      // Une seule fois: quand stop() est complètement terminé et ondataavailable a été appelé
      mediaRecorder.onstop = async () => {
        console.log('[VoiceRecorder] onstop triggered, audio chunks collected:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          console.warn('[VoiceRecorder] No audio data collected!');
          setIsSending(false);
          toast({
            title: 'Erreur',
            description: 'Aucune donnée audio enregistrée.',
            variant: 'destructive',
          });
          resolve();
          return;
        }

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('[VoiceRecorder] Audio blob created, size:', audioBlob.size);

          const tempId = `temp-${Date.now()}`;
          
          // Appeler le callback pour ajouter le message à sentMessages
          onSendingStart?.(tempId);

          // --- STEP 1: Upload l'audio à l'API ---
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voicenote.webm');
          formData.append('duration', recordingTime.toString());
          formData.append('sessionId', session.id);

          console.log('[VoiceRecorder] Uploading audio to API...');
          const uploadResponse = await fetch('/api/voicenotes/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
          }

          const uploadResult = await uploadResponse.json();
          
          if (!uploadResult.success || !uploadResult.voiceNoteId) {
            throw new Error(uploadResult.error || 'Upload failed');
          }

          console.log('[VoiceRecorder] Audio uploaded successfully, voiceNoteId:', uploadResult.voiceNoteId);

          // --- STEP 2: Envoyer le message via socket avec la voiceNoteId ---
          console.log('[VoiceRecorder] Sending voice note message via socket...');
          socket.emit('send_voice_note', {
            voiceNoteId: uploadResult.voiceNoteId,
            roomId,
            tempId,
          });

          console.log('[VoiceRecorder] Voice note message emitted via socket with tempId:', tempId);

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

          resolve();
        } catch (error) {
          console.error('[VoiceRecorder] Error:', error);
          setIsSending(false);
          toast({
            title: 'Erreur',
            description: error instanceof Error ? error.message : 'Erreur lors de l\'envoi de la note vocale.',
            variant: 'destructive',
          });
          resolve();
        }
      };

      // Arrêter l'enregistrement (va déclencher onstop et ondataavailable)
      mediaRecorder.stop();

      // Aussi émettre le recording_stop event
      if (socket && user && roomId) {
        console.log('[VoiceRecorder] Emitting recording_stop for room:', roomId);
        socket.emit('recording_stop', roomId);
      }

      // Arrêter le chronomètre
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      // Arrêter tous les flux audio
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    });
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
