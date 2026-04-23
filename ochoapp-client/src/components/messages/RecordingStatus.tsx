'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/SocketProvider';

interface RecordingUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface RecordingStatusProps {
  roomId: string;
}

export default function RecordingStatus({ roomId }: RecordingStatusProps) {
  const [recordingUsers, setRecordingUsers] = useState<RecordingUser[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRecordingUpdate = (data: { roomId: string; recordingUsers: RecordingUser[] }) => {
      if (data.roomId === roomId) {
        console.log('[RecordingStatus] Updated recording users:', data.recordingUsers);
        setRecordingUsers(data.recordingUsers || []);
      }
    };

    socket.on('recording_update', handleRecordingUpdate);
    
    return () => {
      socket.off('recording_update', handleRecordingUpdate);
    };
  }, [socket, roomId]);

  if (recordingUsers.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b border-border flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-sm text-blue-700 dark:text-blue-300">
        {recordingUsers.map((u) => u.displayName).join(', ')}
        {recordingUsers.length === 1 ? ' est en train d\'enregistrer...' : ' sont en train d\'enregistrer...'}
      </span>
    </div>
  );
}
