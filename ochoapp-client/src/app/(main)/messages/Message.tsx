import UserAvatar from "@/components/UserAvatar";
import { RoomData, MessageData, ReadInfo } from "@/lib/types";
import { useSession } from "../SessionProvider";
import Linkify from "@/components/Linkify";
import { MessageType } from "@prisma/client";
import { QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import Time from "@/components/Time";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import kyInstance from "@/lib/ky";
import { t } from "@/context/LanguageContext";
import { useSocket } from "@/components/providers/SocketProvider";
import { Undo2, Check, CheckCheck } from "lucide-react";
import ReactionOverlay, {
  ReactionData,
  ReactionDetailsPopover,
  ReactionList,
} from "./reaction/ReactionOverlay";

// --- TYPES ---
type MessageProps = {
  message: MessageData;
  room: RoomData;
  highlight?: string;
  isLastInCluster?: boolean; 
  isFirstInCluster?: boolean;
  isMiddleInCluster?: boolean;
  isOnlyMessageInCluster?: boolean;
};

// --- SOUS-COMPOSANT DE SURBRILLANCE ---
function HighlightText({ text, highlight, isOwner }: { text: string; highlight?: string, isOwner: boolean }) {
  if (!highlight || !highlight.trim()) {
    return <Linkify className={cn("text-inherit")}>{text}</Linkify>;
  }

  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeHighlight})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-yellow-400/50 text-foreground dark:text-white p-0 rounded-[4px] px-[1px] leading-none border border-yellow-500/50 h-fit">
            <Linkify>{part}</Linkify>
          </span>
        ) : (
          <Linkify key={i} className={cn("text-inherit")}>{part}</Linkify>
        )
      )}
    </>
  );
}

// --- SOUS-COMPOSANT DE SUPPRESSION ---
export function DeletionPlaceholder({
  onCancel,
  duration = 5000,
}: {
  onCancel: () => void;
  duration?: number;
}) {
  const [progress, setProgress] = useState(100);
  const [timeLeft, setTimeLeft] = useState(duration);
  const size = 18; 
  const stroke = 2; 
  const center = size / 2;
  const radius = size / 2 - stroke / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    const intervalTime = 50;
    const step = (100 * intervalTime) / duration;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const nextValue = prev - step;
        if (nextValue <= 0) {
          clearInterval(timer);
          return 0;
        }
        return nextValue;
      });
      setTimeLeft((prev) => Math.max(0, prev - intervalTime));
    }, intervalTime);
    return () => clearInterval(timer);
  }, [duration]);

  if (progress === 0) return null;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const secondsLeft = Math.ceil(timeLeft / 1000);

  return (
    <div className="relative flex w-full justify-end z-20">
      <div className="relative flex w-fit select-none flex-col items-end">
        <div className="relative flex w-fit items-center justify-between gap-2 overflow-hidden rounded-full border border-destructive/40 bg-destructive/5 p-1.5 pe-4 text-destructive shadow-sm backdrop-blur-sm">
          <div
            className="absolute bottom-0 left-0 h-1 bg-destructive/30 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
          <button
            onClick={onCancel}
            className="z-10 flex items-center gap-1 rounded-full border border-muted-foreground/40 bg-background/40 p-1 text-xs font-bold text-foreground shadow-sm transition-all hover:border-muted-foreground/60 hover:bg-background/30 active:scale-95 dark:border-muted/50 hover:dark:border-muted/60"
          >
            <div className="relative flex items-center justify-center">
              <svg height={size} width={size} className="-rotate-90 transform">
                <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} className="text-muted-foreground/40 dark:text-muted/50" r={radius} cx={center} cy={center} />
                <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} strokeDasharray={circumference} style={{ strokeDashoffset, transition: "stroke-dashoffset 75ms linear" }} strokeLinecap="round" className="text-destructive" r={radius} cx={center} cy={center} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-destructive">{secondsLeft}</span>
            </div>
            <div className="flex items-center gap-0.5 pe-1.5 text-xs font-normal text-primary">
              <Undo2 size={12} strokeWidth={3} />
              <span className="uppercase">{t("cancel")}</span>
            </div>
          </button>
          <span className="z-10 italic tracking-wider">{t("deleting")}</span>
        </div>
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANT : CONTENU DE LA BULLE (DESIGN V2) ---
export const MessageBubbleContent = ({
  message,
  isOwner,
  unavailableMessage,
  onContextMenu,
  createdAt,
  isClone = false,
  toggleCheck,
  highlight,
  isLastInCluster,
  isFirstInCluster,
  isMiddleInCluster,
  isOnlyMessageInCluster,
  readStatus
}: {
  message: MessageData;
  isOwner: boolean;
  unavailableMessage: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  isClone?: boolean;
  toggleCheck?: () => void;
  highlight?: string;
  isLastInCluster?: boolean;
  isFirstInCluster?: boolean;
  isMiddleInCluster?: boolean;
  isOnlyMessageInCluster?: boolean;
  createdAt?: Date;
  readStatus?: 'read' | 'delivered';
}) => {
  
  // --- LOGIQUE BORDER RADIUS (Stacking) ---
  let borderRadiusClass = "";

  if (isOwner) {
    // --- MESSAGES DE L'UTILISATEUR (Droite) ---
    if (isOnlyMessageInCluster) {
      borderRadiusClass = "rounded-3xl";
    } else if (isFirstInCluster) {
      borderRadiusClass = "rounded-3xl rounded-br-[4px]";
    } else if (isMiddleInCluster) {
      borderRadiusClass = "rounded-3xl rounded-tr-[4px] rounded-br-[4px]";
    } else if (isLastInCluster) {
      borderRadiusClass = "rounded-3xl rounded-tr-[4px] rounded-br-2xl";
    } else {
      borderRadiusClass = "rounded-3xl";
    }

  } else {
    // --- MESSAGES DES AUTRES (Gauche) ---
    if (isOnlyMessageInCluster) {
      borderRadiusClass = "rounded-3xl";
    } else if (isFirstInCluster) {
      borderRadiusClass = "rounded-3xl rounded-bl-[4px]";
    } else if (isMiddleInCluster) {
      borderRadiusClass = "rounded-3xl rounded-tl-[4px] rounded-bl-[4px]";
    } else if (isLastInCluster) {
      borderRadiusClass = "rounded-3xl rounded-tl-[4px]";
    } else {
      borderRadiusClass = "rounded-3xl";
    }
  }

  // --- NOUVEAU DESIGN SYSTEM ---
  const bubbleDesign = isOwner
    ? // OWNER: Dark Mode = Gris foncé (Solid) | Light Mode = Bleu Vibrant
      "dark:bg-neutral-800 dark:text-white dark:border-transparent bg-blue-600 text-white shadow-sm border-transparent"
    : // OTHER: Dark Mode = Transparent + Bordure Fine | Light Mode = Blanc + Bordure/Ombre
      "dark:bg-transparent dark:text-neutral-200 dark:border-neutral-700 bg-white text-gray-800 border-gray-200 shadow-sm border";

  return (
    <div className={cn("relative w-fit group/bubble", isClone && "h-full")}>
      <div
        onClick={!isClone ? toggleCheck : undefined}
        onContextMenu={!isClone ? onContextMenu : (e) => e.preventDefault()}
        className={cn(
          "relative w-fit px-5 py-2 text-sm md:text-base leading-relaxed transition-all duration-200 border",
          bubbleDesign,
          !message.content && "bg-transparent text-muted-foreground outline outline-2 outline-muted-foreground",
          isClone && "cursor-default shadow-lg ring-2 ring-background/50",
          borderRadiusClass
        )}
      >
        <div className="pr-6 pb-1">
            {message.content ? (
                <HighlightText
                text={message.content}
                highlight={highlight}
                isOwner={isOwner}
                />
            ) : (
                <span className="italic">{unavailableMessage}</span>
            )}
        </div>

        {/* Heure et Status DANS la bulle */}
        {createdAt && (
          <div className={cn(
              "absolute bottom-0 right-2.5 flex items-center gap-1 text-[10px]",
              // Couleurs adaptées au nouveau contraste
              isOwner ? "text-blue-100 dark:text-neutral-400" : "text-muted-foreground"
          )}>
             <time className="opacity-90">
                <Time time={createdAt} clock />
             </time>
             {isOwner && !isClone && readStatus && (
                <span title={readStatus === 'read' ? "Lu" : "Distribué"}>
                    {readStatus === 'read' 
                        ? <CheckCheck size={14} className="text-blue-200 dark:text-blue-400" /> 
                        : <Check size={14} className="opacity-70" />
                    }
                </span>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function Message({
  message,
  room,
  highlight, 
  isLastInCluster = true, 
  isFirstInCluster = true,
  isMiddleInCluster = false,
}: MessageProps) {
  const { user: loggedUser } = useSession();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const messageId = message.id;
  const roomId = room.id;
  const [showReadDetails, setShowReadDetails] = useState(false);

  const [activeOverlayRect, setActiveOverlayRect] = useState<DOMRect | null>(null);
  const [activeDetailsRect, setActiveDetailsRect] = useState<DOMRect | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs
  const messageRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);

  const {
    unavailableMessage
  } = t();

  // --- REQUETES REACTIONS ---
  const reactionsQueryKey: QueryKey = ["reactions", messageId];
  const { data: reactions = [] } = useQuery({
    queryKey: reactionsQueryKey,
    queryFn: () => kyInstance.get(`/api/message/${messageId}/reactions`).json<ReactionData[]>(),
    staleTime: Infinity,
  });

  // --- SOCKET REACTIONS (Listening for updates) ---
  useEffect(() => {
    if (!socket) return;
    const handleReactionUpdate = (data: { messageId: string; reactions: ReactionData[]; }) => {
      if (data.messageId === messageId) {
        queryClient.setQueryData(reactionsQueryKey, data.reactions);
      }
    };
    socket.on("message_reaction_update", handleReactionUpdate);
    return () => { socket.off("message_reaction_update", handleReactionUpdate); };
  }, [socket, messageId, queryClient, reactionsQueryKey]);

  // --- GESTION OPTIMISTE DES REACTIONS ---
  const handleSendReaction = (emoji: string) => {
    if (!socket || !loggedUser) return;

    const previousReactions = queryClient.getQueryData<ReactionData[]>(reactionsQueryKey);

    queryClient.setQueryData<ReactionData[]>(reactionsQueryKey, (old) => {
      const current = old ? [...old] : [];
      const existingReactionIndex = current.findIndex(r => r.content === emoji);
      const alreadyReactedWithEmoji = existingReactionIndex !== -1 && current[existingReactionIndex].hasReacted;

      if (alreadyReactedWithEmoji) return current;

      if (existingReactionIndex !== -1) {
          const updatedReaction = { ...current[existingReactionIndex] };
          updatedReaction.count += 1;
          updatedReaction.hasReacted = true;
          updatedReaction.users = [
              { 
                id: loggedUser.id, 
                displayName: loggedUser.displayName, 
                username: loggedUser.username, 
                avatarUrl: loggedUser.avatarUrl,
                reactedAt: new Date()
              }, 
              ...updatedReaction.users
          ];
          current[existingReactionIndex] = updatedReaction;
          return current;
      } else {
          return [
              ...current,
              {
                  content: emoji,
                  count: 1,
                  hasReacted: true,
                  users: [{
                      id: loggedUser.id,
                      displayName: loggedUser.displayName,
                      username: loggedUser.username,
                      avatarUrl: loggedUser.avatarUrl,
                      reactedAt: new Date()
                  }],
                  createdAt: new Date()
              }
          ];
      }
    });

    try {
        const existingReaction = reactions.find((r) => r.content === emoji && r.hasReacted);
        if (existingReaction) {
            socket.emit("remove_reaction", { messageId, roomId });
        } else {
            socket.emit("add_reaction", { messageId, roomId, content: emoji });
        }
    } catch (error) {
        queryClient.setQueryData(reactionsQueryKey, previousReactions);
    }
  };

  const handleRemoveMyReaction = () => {
    if (!socket || !loggedUser) return;
    const previousReactions = queryClient.getQueryData<ReactionData[]>(reactionsQueryKey);

    queryClient.setQueryData<ReactionData[]>(reactionsQueryKey, (old) => {
        if (!old) return [];
        return old.map(reaction => {
            if (reaction.hasReacted) {
                const newUsers = reaction.users.filter(u => u.id !== loggedUser.id);
                return {
                    ...reaction,
                    hasReacted: false,
                    count: Math.max(0, reaction.count - 1),
                    users: newUsers
                };
            }
            return reaction;
        }).filter(reaction => reaction.count > 0);
    });

    try {
        socket.emit("remove_reaction", { messageId, roomId });
    } catch (error) {
        queryClient.setQueryData(reactionsQueryKey, previousReactions);
    }
  };

  const handleShowDetails = (event: React.MouseEvent, reactionContent?: string) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveDetailsRect(event.currentTarget.getBoundingClientRect());
    setSelectedReaction(reactionContent || null);
  };

  // --- LOGIQUE SUPPRESSION MESSAGE ---
  const DELETION_DELAY = 8000;
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDeleting && !deleteTimerRef.current) {
      deleteTimerRef.current = setTimeout(() => {
        if (socket) socket.emit("delete_message", { messageId: message.id, roomId: room.id });
      }, DELETION_DELAY);
    }
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, [isDeleting, socket, message.id, room.id]);

  const handleCancelDelete = () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setIsDeleting(false);
  };

  const handleRequestDelete = () => setIsDeleting(true);

  // --- READ STATUS (VUES) ---
  const queryKey: QueryKey = ["message", "views", message.id];
  const { data } = useQuery({
    queryKey,
    queryFn: () => kyInstance.get(`/api/message/${messageId}/reads`, { throwHttpErrors: false }).json<ReadInfo>(),
    staleTime: Infinity,
    throwOnError: false,
  });

  const reads = data?.reads ?? [];
  const isSender = message.senderId === loggedUser?.id;

  const hasBeenRead = reads.filter(r => r.id !== message.senderId).length > 0;
  const readStatus = hasBeenRead ? 'read' : 'delivered';

  useEffect(() => {
    if (!socket || !loggedUser || !room) return;
    const hasRead = reads.some((r) => r.id === loggedUser.id);
    if (!isSender && !hasRead) {
      socket.emit("mark_message_read", { messageId, roomId });
    }
    const handleReadUpdate = (data: { messageId: string; reads: any[] }) => {
      if (data.messageId === messageId) {
        queryClient.setQueryData(queryKey, { reads: data.reads });
      }
    };
    socket.on("message_read_update", handleReadUpdate);
    return () => { socket.off("message_read_update", handleReadUpdate); };
  }, [socket, messageId, roomId, loggedUser, message.senderId, reads, queryClient, queryKey]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveOverlayRect(rect);
  };

  if (!loggedUser) return null;
  const readers = reads.filter((read) => read.id !== loggedUser.id && read.id !== message.senderId);
  const messageType: MessageType = message.type;
  const isOwner = message.senderId === loggedUser.id;

  if (messageType !== "CONTENT" && messageType !== "REACTION") return null; 
  if (messageType !== "CONTENT") return null;

  return (
    <>
      {isDeleting ? (
        <DeletionPlaceholder onCancel={handleCancelDelete} duration={DELETION_DELAY} />
      ) : (
        <>
          {/* OVERLAY PICKER */}
          {activeOverlayRect && (
            <ReactionOverlay
              message={message}
              originalRect={activeOverlayRect}
              onClose={() => setActiveOverlayRect(null)}
              isOwner={isOwner}
              unavailableMessage={unavailableMessage}
              onDeleteRequest={handleRequestDelete}
              onReact={handleSendReaction}
              currentReactions={reactions}
            />
          )}

          {/* MODAL DETAILS */}
          {activeDetailsRect && (
            <ReactionDetailsPopover
              reactions={reactions}
              currentUserId={loggedUser.id}
              initialTab={selectedReaction}
              onClose={() => {
                setActiveDetailsRect(null);
                setSelectedReaction(null);
              }}
              onRemoveReaction={handleRemoveMyReaction}
              anchorRect={activeDetailsRect}
            />
          )}

          <div
            className={cn(
              "relative flex w-full flex-col gap-1 mb-2",
              activeOverlayRect ? "z-0" : "",
            )}
            ref={messageRef}
          >
            <div
              className={cn(
                "flex w-full gap-2 items-end",
                message.senderId === loggedUser.id && "flex-row-reverse",
              )}
            >
              {message.senderId !== loggedUser.id && (
                <span className="pb-1 z-10">
                  {isLastInCluster ? (
                    <UserAvatar
                      userId={message.senderId}
                      avatarUrl={message.sender?.avatarUrl}
                      size={28}
                      className="flex-none shadow-sm border border-border"
                    />
                  ) : (
                    <div className="size-7 flex-none" />
                  )}
                </span>
              )}

              <div className={cn("group/message relative w-fit max-w-[75%] select-none flex flex-col", isOwner ? "items-end" : "items-start")}>
                
                {message.senderId !== loggedUser.id && isFirstInCluster && room.isGroup && (
                  <div className="ps-2 text-xs font-semibold text-muted-foreground/80 mb-1 ml-1">
                    {message.sender?.displayName || "Utilisateur"}
                  </div>
                )}

                <div className="relative">
                    <div
                        className={cn("relative z-10", activeOverlayRect ? "opacity-0" : "opacity-100")}
                        onContextMenu={handleContextMenu}
                        ref={bubbleRef}
                    >
                        <MessageBubbleContent
                            message={message}
                            isOwner={isOwner}
                            unavailableMessage={unavailableMessage}
                            toggleCheck={() => {}} 
                            highlight={highlight}
                            isLastInCluster={isLastInCluster}
                            isFirstInCluster={isFirstInCluster}
                            isMiddleInCluster={isMiddleInCluster}
                            isOnlyMessageInCluster={isLastInCluster && isFirstInCluster}
                            createdAt={new Date(message.createdAt)}
                            readStatus={readStatus}
                        />
                    </div>

                    <div className={cn(
                        "absolute -bottom-3 z-20", 
                        isOwner ? "left-0 -translate-x-3" : "right-0 translate-x-3",
                        activeOverlayRect ? "opacity-0" : "opacity-100"
                    )}>
                        <ReactionList
                            reactions={reactions}
                            onReact={handleSendReaction}
                            onShowDetails={handleShowDetails}
                        />
                    </div>
                </div>

                {readers.length > 0 && isLastInCluster && (
                  <div className={cn("relative mt-2 mr-1 flex w-full", isOwner ? "justify-end" : "justify-start")}>
                     <button
                        ref={detailsButtonRef}
                        onClick={() => setShowReadDetails(!showReadDetails)}
                        className="flex -space-x-2 cursor-pointer hover:scale-105 transition-transform p-1 opacity-90 hover:opacity-100"
                     >
                        {readers.slice(0, 3).map((user, i) => (
                           <div key={user.id} className="relative z-[1]">
                               <UserAvatar 
                                  userId={user.id} 
                                  avatarUrl={user.avatarUrl} 
                                  size={16} 
                                  className="border border-background ring-1 ring-muted/20" 
                               />
                           </div>
                        ))}
                        {readers.length > 3 && (
                            <div className="h-4 w-4 rounded-full bg-muted text-[8px] flex items-center justify-center border border-background text-muted-foreground font-bold z-10">
                                +{readers.length - 3}
                            </div>
                        )}
                     </button>
                     {showReadDetails && (
                         <div className="absolute bottom-6 right-0 min-w-[160px] bg-popover/95 backdrop-blur rounded-xl shadow-xl border border-border p-2 z-30 animate-in fade-in slide-in-from-bottom-2">
                             <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
                                 {t("readBy") || "Lu par"}
                             </h4>
                             <div className="flex flex-col gap-2 max-h-32 overflow-y-auto scrollbar-thin">
                                 {readers.map(user => (
                                     <div key={user.id} className="flex items-center justify-between text-xs">
                                         <div className="flex items-center gap-2">
                                             <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={20} />
                                             <span className="text-foreground font-medium truncate max-w-[90px]">{user.displayName}</span>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}