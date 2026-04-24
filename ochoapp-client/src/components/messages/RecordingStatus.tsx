'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/SocketProvider';
import { useSession } from '@/app/(main)/SessionProvider';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

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
  const { user: loggedUser } = useSession();

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRecordingUpdate = (data: { roomId: string; recordingUsers: RecordingUser[] }) => {
      if (data.roomId === roomId) {
        console.log('[RecordingStatus] Updated recording users:', data.recordingUsers);
        const filteredUsers = data.recordingUsers.filter(
          (u) => u.id !== loggedUser?.id,
        );
        setRecordingUsers(filteredUsers || []);
      }
    };

    socket.on('recording_update', handleRecordingUpdate);
    
    return () => {
      socket.off('recording_update', handleRecordingUpdate);
    };
  }, [socket, roomId, loggedUser?.id]);

  if (recordingUsers.length === 0) {
    return null;
  }

  const MAX_AVATARS = 4;
  const hasMore = recordingUsers.length > MAX_AVATARS;
  const visibleUsers = recordingUsers.slice(
    0,
    hasMore ? MAX_AVATARS - 1 : MAX_AVATARS,
  );
  const remainingCount = recordingUsers.length - visibleUsers.length;

  return (
    <div className="relative z-0 mb-4 flex w-full select-none gap-2 duration-300 animate-in fade-in slide-in-from-bottom-2">
      {recordingUsers.length === 1 ? (
        <UserAvatar
          userId={recordingUsers[0].id}
          avatarUrl={recordingUsers[0].avatarUrl}
          size={24}
          key={recordingUsers[0].id}
          className="border-2 border-background"
        />
      ) : (
        <div className="z-0 flex size-6 min-h-6 min-w-6 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
          {recordingUsers.length || 0}
        </div>
      )}
      <div className="relative flex w-full items-start gap-2">
        {recordingUsers.length > 1 && (
          <div className="absolute left-0 top-full z-[2] flex h-8 -translate-y-[30%] items-center -space-x-2 overflow-hidden py-1">
            {visibleUsers.map((user, index) => (
              <UserAvatar
                avatarUrl={user.avatarUrl}
                size={20}
                userId={user.id}
                key={user.id}
                className="animate-appear-r border-2 border-background"
              />
            ))}

            {hasMore && (
              <div className="z-10 flex h-6 w-6 animate-appear-r items-center justify-center rounded-full border-2 border-background bg-muted text-xs text-muted-foreground">
                +{remainingCount}
              </div>
            )}
          </div>
        )}
        <div
          className={cn("group/message relative w-fit max-w-[75%] select-none")}
        >
          <div className="mb-1 ps-2 text-xs font-medium text-slate-500 transition-opacity dark:text-slate-400">
            {recordingUsers.length === 1
              ? `${recordingUsers[0].displayName.split(" ")[0]}`
              : recordingUsers.length === 2
                ? `${recordingUsers[0].displayName.split(" ")[0]} et ${recordingUsers[1].displayName.split(" ")[0]} enregistrent...`
                : `${recordingUsers[0].displayName.split(" ")[0]}, ${recordingUsers[1].displayName.split(" ")[0]} et ${recordingUsers.length - 2 == 1 ? recordingUsers[2].displayName.split(" ")[0] : `${recordingUsers.length - 2} autres`} enregistrent...`}
          </div>
          <div className="relative h-fit w-fit">
            <div
              className={cn(
                "w-fit select-none rounded-3xl bg-primary/10 p-3.5",
              )}
            >
              <div className="flex gap-2 items-center justify-center w-8">
                <Mic className="h-5 w-5 text-primary animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
