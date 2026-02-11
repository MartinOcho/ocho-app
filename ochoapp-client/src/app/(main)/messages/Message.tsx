import UserAvatar from "@/components/UserAvatar";
import { RoomData, MessageData, ReadInfo, MessageAttachment } from "@/lib/types";
import { useSession } from "../SessionProvider";
import Linkify from "@/components/Linkify";
import { MessageType } from "@prisma/client";
import { QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import Time from "@/components/Time";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import kyInstance from "@/lib/ky";
import { useSocket } from "@/components/providers/SocketProvider";
import { 
  Undo2, 
  Check, 
  CheckCheck, 
  UserPlus, 
  LogOut, 
  ShieldAlert, 
  Info,
  Sparkles,
  UserRoundPlus
} from "lucide-react";
import ReactionOverlay, {
  ReactionData,
  ReactionDetailsPopover,
  ReactionList,
} from "./reaction/ReactionOverlay";
import GroupAvatar from "@/components/GroupAvatar";
import MediaStrip from "@/components/messages/MediaStrip";
import { useActiveRoom } from "@/context/ChatContext";
import { useTranslation } from "@/context/LanguageContext";

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
  const { t } = useTranslation();
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
    <div className="relative flex w-full justify-end z-0">
      <div className="relative flex w-fit select-none flex-col items-end">
        <div className="relative flex w-fit items-center justify-between gap-2 overflow-hidden rounded-full border border-destructive/40 bg-destructive/5 p-1.5 pe-4 text-destructive shadow-sm backdrop-blur-sm">
          <div
            className="absolute bottom-0 left-0 h-1 bg-destructive/30 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
          <button
            onClick={onCancel}
            className="z-0 flex items-center gap-1 rounded-full border border-muted-foreground/40 bg-background/40 p-1 text-xs font-bold text-foreground shadow-sm transition-all hover:border-muted-foreground/60 hover:bg-background/30 active:scale-95 dark:border-muted/50 hover:dark:border-muted/60"
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
          <span className="z-0 italic tracking-wider">{t("deleting")}</span>
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
  readStatus,
  onMediaOpen,
  onMediaClose,
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
  onMediaOpen?: () => void;
  onMediaClose?: () => void;
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
      borderRadiusClass = "rounded-3xl rounded-tr-[4px]";
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
    <div className={cn("relative w-fit group/bubble flex flex-col gap-1", isClone && "h-full", isOwner ? "items-end" : "items-start")}>
        {message.attachments && !isClone && message.attachments.length > 0 && (
          <MediaStrip 
            attachments={message.attachments as MessageAttachment[]}
            className={cn(
              "media-strip-wrapper border-border",
              isOwner ? "justify-end" : "justify-start",
              !!message.content.trim() && (isOwner ? "border-r-4 pr-1" : "border-l-4 pl-1")
            )}
            onMediaOpen={onMediaOpen}
            onMediaClose={onMediaClose}
          />
        )}
        {/* Heure et Status DANS la bulle */}
        {createdAt && (!message.content.trim() && message.attachments.length) && (
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
                        ? <CheckCheck size={14} className="text-cyan-200 dark:text-blue-400" /> 
                        : <Check size={14} className="opacity-70" />
                    }
                </span>
             )}
          </div>
        )}
      <div
        onClick={!isClone ? toggleCheck : undefined}
        onContextMenu={!isClone ? onContextMenu : (e) => e.preventDefault()}
        className={cn(
          "relative w-fit px-5 py-2 text-sm md:text-base leading-relaxed transition-all duration-200 border",
          bubbleDesign,
          !message.content && "bg-transparent text-muted-foreground outline outline-2 outline-muted-foreground",
          isClone && "cursor-default shadow-lg ring-2 ring-background/50",
          borderRadiusClass, 
          !message.content.trim() && message.attachments.length && "hidden"
        )}
      >
        {/* Conteneur de texte avec marker pour le calcul de position */}
        <div className="pr-4 pb-1 text-content-wrapper">
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
                        ? <CheckCheck size={14} className="text-cyan-200 dark:text-blue-400" /> 
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
  const { t } = useTranslation();
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
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  // Appliquer le z-index au cluster parent lorsque le media est ouvert
  useEffect(() => {
    const clusterEl = messageRef.current?.closest('[data-message-cluster]') as HTMLElement | null;
    if (!clusterEl) return;

    if (isMediaOpen) {
      // sauvegarder l'état précédent
      try {
        (clusterEl.dataset as any)._prevPosition = clusterEl.style.position || "";
        (clusterEl.dataset as any)._prevZ = clusterEl.style.zIndex || "";
      } catch (e) {}
      if (!clusterEl.style.position) clusterEl.style.position = "relative";
      clusterEl.style.zIndex = "10000";
    } else {
      try {
        const prevZ = (clusterEl.dataset as any)._prevZ;
        const prevPosition = (clusterEl.dataset as any)._prevPosition;
        if (prevZ !== undefined) clusterEl.style.zIndex = prevZ;
        else clusterEl.style.zIndex = "";
        if (prevPosition !== undefined) clusterEl.style.position = prevPosition;
        else clusterEl.style.position = "";
        delete (clusterEl.dataset as any)._prevZ;
        delete (clusterEl.dataset as any)._prevPosition;
      } catch (e) {}
    }
  }, [isMediaOpen]);


  // Refs
  const messageRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);

  const {
    appUser,
    newMember,
    youAddedMember,
    addedYou,
    addedMember,
    memberLeft,
    youRemovedMember,
    youLeftGroup,
    removedYou,
    removedMember,
    memberBanned,
    youBannedMember,
    bannedYou,
    bannedMember,
    youCreatedGroup,
    createdGroup,
    canChatWithYou,
    messageYourself,
    unavailableMessage,
    deletedChat,
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
  const isRecipient = message.recipient?.id === loggedUser?.id;

  const hasBeenRead = reads.filter(r => r.id !== message.senderId).length > 0;
  const readStatus = (hasBeenRead || roomId.startsWith('saved-')) ? 'read' : 'delivered';

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

  // --- GESTION DU CLIC DROIT AVEC CALCUL AJUSTÉ ---
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    
    const target = e.currentTarget as HTMLElement;
    let rect = target.getBoundingClientRect();

    if (message.attachments && message.attachments.length > 0) {
       const textContainer = target.querySelector('.text-content-wrapper');
       if (textContainer) {
          const textRect = textContainer.getBoundingClientRect();
          const style = window.getComputedStyle(target);
          const paddingTop = parseFloat(style.paddingTop) || 8; // fallback to default py-2

          // Le nouveau Top = Le haut du texte - le padding du container
          const newTop = textRect.top - paddingTop;
          
          // La nouvelle Hauteur = La distance entre ce nouveau top et le bas original
          const newHeight = rect.bottom - newTop;

          // On crée un objet compatible DOMRect
          rect = {
            top: newTop,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: newHeight,
            x: rect.left,
            y: newTop,
            toJSON: () => {}
          } as DOMRect;
       }
    }

    setActiveOverlayRect(rect);
  };

  if (!loggedUser) return null;

  // --- LOGIQUE NOMS ET TYPES SYSTEME ---
  const messageType: MessageType = message.type;
  const otherUser = room.id === `saved-${loggedUser.id}`
      ? { user: loggedUser, userId: loggedUser.id }
      : room?.members?.filter((member) => member.userId !== loggedUser.id)[0];
  
  const otherUserFirstName = otherUser?.user?.displayName.split(" ")[0] || appUser;
  const senderFirstName = message.sender?.displayName.split(" ")[0] || appUser;
  const recipientFirstName = message.recipient?.displayName.split(" ")[0] || appUser;

  // Construction des messages système
  let systemContent: React.ReactNode = null;
  let systemIcon: React.ReactNode = null;
  let SystemWrapperClass = "flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground/80 w-full";

  // --- LOGIQUE CONTENU SYSTEME ---
  if (messageType !== "CONTENT" && messageType !== "REACTION") {
    
    // 1. NEWMEMBER / LEAVE / BAN
    if (message.recipient && room.isGroup) {
      const memberName = recipientFirstName;
      
      // -- NEWMEMBER --
      if (messageType === "NEWMEMBER") {
        systemIcon = <UserRoundPlus size={14} className="text-green-500" />;
        let text = newMember.replace("[name]", memberName);
        if (message.sender) {
          isSender
            ? (text = youAddedMember.replace("[name]", memberName))
            : (text = isRecipient
                ? addedYou.replace("[name]", senderFirstName)
                : addedMember
                    .replace("[name]", senderFirstName)
                    .replace("[member]", memberName));
        }
        systemContent = text;
      }
      // -- LEAVE --
      if (messageType === "LEAVE") {
        systemIcon = <LogOut size={14} className="text-orange-400" />;
        let text = memberLeft.replace("[name]", memberName);
        if (message.sender) {
          isSender
            ? (text = youRemovedMember.replace("[name]", memberName))
            : (text = isRecipient
                ? removedYou.replace("[name]", senderFirstName)
                : removedMember
                    .replace("[name]", senderFirstName)
                    .replace("[member]", memberName));
        }
        if (isRecipient) {
          text = youLeftGroup.replace("[name]", memberName);
        }
        systemContent = text;
      }
      // -- BAN --
      if (messageType === "BAN") {
        systemIcon = <ShieldAlert size={14} className="text-destructive" />;
        let text = memberBanned.replace("[name]", memberName);
        if (message.sender) {
          isSender
            ? (text = youBannedMember.replace("[name]", memberName))
            : (text = isRecipient
                ? bannedYou.replace("[name]", senderFirstName)
                : bannedMember
                    .replace("[name]", senderFirstName)
                    .replace("[member]", memberName));
        }
        systemContent = text;
      }
    }

    // 2. CREATE
    if (messageType === "CREATE") {
        const text = room.isGroup
            ? isSender
                ? youCreatedGroup
                : createdGroup.replace("[name]", senderFirstName)
            : canChatWithYou.replace("[name]", otherUserFirstName || appUser);
            
        // Design Spécial pour CREATE (Room Details)
        if (room.isGroup) {
            return (
                <div className="w-full flex justify-center py-6 select-none">
                    <div className="flex flex-col items-center justify-center gap-3 p-4 px-8 rounded-2xl border border-border bg-muted/50 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-muted/60 dark:text-muted-foreground/80 max-w-[280px]">
                        <div className="relative">
                            <GroupAvatar avatarUrl={room.groupAvatarUrl} size={80} className="shadow-md border-2 border-background" />
                            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full border-2 border-background">
                                <Sparkles size={12} fill="currentColor" />
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="font-bold text-foreground line-clamp-1 text-sm">{room.name || t("group")}</h3>
                            <p className="text-xs text-muted-foreground">{text}</p>
                            <div className="text-[10px] text-muted-foreground/60 pt-2 border-t border-muted/50 mt-2">
                                <Time time={message.createdAt} full />
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="w-full flex justify-center py-6 select-none">
                    <div className="flex flex-col items-center justify-center gap-3 p-4 px-8 rounded-2xl border border-border bg-muted/50 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-muted/60 dark:text-muted-foreground/80 max-w-[280px]">
                        <div className="relative">
                            <UserAvatar userId={otherUser?.user?.id || ''} avatarUrl={otherUser?.user?.avatarUrl} size={80} className="shadow-md border-2 border-background" />
                            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-1 rounded-full border-2 border-background">
                                <Sparkles size={12} fill="currentColor" />
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="font-bold text-foreground line-clamp-1 text-sm">{otherUser?.user?.displayName || t("appUser")}</h3>
                            <p className="text-xs text-muted-foreground">{text}</p>
                            <div className="text-[10px] text-muted-foreground/60 pt-2 border-t border-muted/50 mt-2">
                                <Time time={message.createdAt} full />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // 3. SAVED
    if (messageType === "SAVED") {
        systemContent = messageYourself;
        systemIcon = <Check size={14} />;
    }

    // 4. CLEAR / DELETE
    if (messageType === "CLEAR") systemContent = t("noMessage");
    if (messageType === "DELETE") systemContent = deletedChat;

    // Rendu des messages système génériques
    if (systemContent) {
        return (
            <div className={SystemWrapperClass}>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border dark:border-muted/50 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-muted/60 dark:text-muted-foreground/80">
                    {systemIcon}
                    <span className="font-medium">{systemContent}</span>
                    <span className="text-[10px] opacity-60 pl-1 border-l border-foreground/10 ml-1">
                        <Time time={message.createdAt} />
                    </span>
                </div>
            </div>
        );
    }
  }

  // Si c'est un message REACTION simple sans contenu, on ne l'affiche pas (géré par overlay)
  if (messageType === "REACTION" || (messageType !== "CONTENT" && !systemContent)) return null; 

  // --- RENDU MESSAGES CHAT (CONTENT) ---
  const readers = reads.filter((read) => read.id !== loggedUser.id && read.id !== message.senderId);
  const isOwner = message.senderId === loggedUser.id;

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
              isMediaOpen ? "z-[10000]" : activeOverlayRect ? "z-0" : "",
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
                <span className="pb-1 z-0">
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
                        className={cn("relative z-0", activeOverlayRect ? "opacity-0" : "opacity-100")}
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
                          onMediaOpen={() => setIsMediaOpen(true)}
                          onMediaClose={() => setIsMediaOpen(false)}
                        />
                    </div>

                    <div className={cn(
                        "absolute -bottom-3", 
                        isOwner ? "left-0 -translate-x-3" : "right-0 translate-x-3",
                        !activeOverlayRect && !activeDetailsRect ? "z-0 pointer-events-auto" : "z-50 pointer-events-none opacity-0",
                    )}>
                        <ReactionList
                            reactions={reactions}
                            onReact={handleSendReaction}
                            onShowDetails={handleShowDetails}
                        />
                    </div>
                </div>

                {room.isGroup && readers.length > 0 && isLastInCluster && (
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
                            <div className="h-[16px] w-[16px] rounded-full bg-muted text-[8px] flex items-center justify-center border border-background text-muted-foreground font-bold z-10">
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

type TypingIndicatorProps = {
  typingUsers: {
    id: string;
    displayName: string;
    avatarUrl: string;
  }[];
};

export function TypingIndicator({ typingUsers = [] }: TypingIndicatorProps) {
  if (!typingUsers.length) return null;
  const MAX_AVATARS = 4;
  const hasMore = typingUsers.length > MAX_AVATARS;
  const visibleUsers = typingUsers.slice(
    0,
    hasMore ? MAX_AVATARS - 1 : MAX_AVATARS,
  );
  const remainingCount = typingUsers.length - visibleUsers.length;

  return (
    <div className="relative z-0 mb-4 flex w-full select-none gap-2 duration-300 animate-in fade-in slide-in-from-bottom-2">
      {typingUsers.length === 1 ? (
        <UserAvatar
          userId={typingUsers[0].id}
          avatarUrl={typingUsers[0].avatarUrl}
          size={24}
          key={typingUsers[0].id}
          className="border-2 border-background"
        />
      ) : (
        <div className="z-0 flex size-6 min-h-6 min-w-6 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
          {typingUsers.length || 0}
        </div>
      )}
      <div className="relative flex w-full items-start gap-2">
        {typingUsers.length > 1 && (
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
        <div className={cn("group/message relative w-fit max-w-[75%] select-none")}>
          <div className="mb-1 ps-2 text-xs font-medium text-slate-500 transition-opacity dark:text-slate-400">
            {typingUsers.length === 1
              ? `${typingUsers[0].displayName.split(" ")[0]}`
              : typingUsers.length === 2
                ? `${typingUsers[0].displayName.split(" ")[0]} et ${typingUsers[1].displayName.split(" ")[0]} écrivent...`
                : `${typingUsers[0].displayName.split(" ")[0]}, ${typingUsers[1].displayName.split(" ")[0]} et ${typingUsers.length - 2 == 1 ? typingUsers[2].displayName.split(" ")[0] : `${typingUsers.length - 2} autres`} écrivent...`}
          </div>
          <div className="relative h-fit w-fit">
            <div
              className={cn(
                "w-fit select-none rounded-3xl bg-primary/10 p-3.5",
              )}
            >
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce-half rounded-full bg-muted-foreground/50 [animation-delay:-0.5s]"></div>
                <div className="h-2 w-2 animate-bounce-half rounded-full bg-muted-foreground/50 [animation-delay:-0.25s]"></div>
                <div className="h-2 w-2 animate-bounce-half rounded-full bg-muted-foreground/50"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}