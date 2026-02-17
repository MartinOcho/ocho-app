"use client";

import UserAvatar from "@/components/UserAvatar";
import { RoomData, NotificationCountInfo, UserData, SocketTypingUpdateEvent } from "@/lib/types";
import { useSession } from "../SessionProvider";
import GroupAvatar from "@/components/GroupAvatar";
import { MessageType, VerifiedType } from "@prisma/client";
import Time from "@/components/Time";
import { cn } from "@/lib/utils";
import { QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import FormattedInt from "@/components/FormattedInt";
import Verified from "@/components/Verified";
import { useProgress } from "@/context/ProgressContext";
import { useEffect, useState, useMemo } from "react";
import { useSocket } from "@/components/providers/SocketProvider";
import { useTranslation } from "@/context/LanguageContext";
import { Image as ImageIcon, Video as VideoIcon, AtSign } from "lucide-react";

interface RoomProps {
  room: RoomData;
  active: boolean;
  onSelect: () => void;
  highlight?: string; // Prop pour la recherche
}

function HighlightText({
  text,
  highlight,
}: {
  text: string;
  highlight?: string;
}) {
  // Convert mentions from @[DisplayName](userId) format to @DisplayName plain text
  const textWithMentionsConverted = text.replace(/\n/g, " ").replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "@$1");

  if (!highlight || !highlight.trim()) {
    return <>{textWithMentionsConverted}</>;
  }
  
  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = textWithMentionsConverted.split(new RegExp(`(${safeHighlight})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span
            key={i}
            className="h-fit rounded border border-amber-500 bg-amber-500/50 p-0 px-[1px] leading-none"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function RoomPreview({
  room,
  active,
  onSelect,
  highlight,
}: RoomProps) {
  const { t } = useTranslation();
  const { user: loggedinUser } = useSession();
  const { socket, isConnected } = useSocket();
  const [typing, setTyping] = useState<{
    isTyping: boolean;
    typingUsers: {
      id: string;
      displayName: string;
      avatarUrl: string;
    }[];
  }>({ isTyping: false, typingUsers: [] });

  console.log(typing);
  

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRoomUnreadCount = (data: { roomId: string; unreadCount: number }) => {
      if (data.roomId === room.id) {
        queryClient.setQueryData<NotificationCountInfo>(
          ["room", "unread", room.id],
          { unreadCount: data.unreadCount }
        );
      }
    };
    const handleReceiveMessage = (data: { roomId: string; newMessage: any }) => {
      if (data.roomId === room.id && data.newMessage.senderId !== loggedinUser?.id) {
        queryClient.setQueryData<NotificationCountInfo>(
          ["room", "unread", room.id],
          (oldData) => ({
            unreadCount: (oldData?.unreadCount || 0) + 1
          })
        );
      }
    };
    
    socket.on("room_unread_count_update", handleRoomUnreadCount);
    socket.on("receive_message", handleReceiveMessage);
    
    return () => {
      socket.off("room_unread_count_update", handleRoomUnreadCount);
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [socket, isConnected, room.id, queryClient, loggedinUser?.id]);

  useEffect(() => {
    if (!socket || !isConnected || !room.id) return;

    const handleTypingUpdate = (data: SocketTypingUpdateEvent) => {
      console.log(data);
      
      const isTyping = !!data.typingUsers
        .filter((u) => u.id !== loggedinUser?.id)
        .filter((u) => u.displayName !== undefined).length;
      if (data.roomId === room.id) {
        setTyping({
          isTyping,
          typingUsers: data.typingUsers
            .filter((u) => u.id !== loggedinUser?.id)
            .filter((u) => u.displayName !== undefined),
        });
      }
    };

    socket.on("typing_update", handleTypingUpdate);
    return () => {
      socket.off("typing_update", handleTypingUpdate);
    };
  }, [socket, isConnected, room.id, loggedinUser?.id]);

  const {
    appUser,
    groupChat,
    you,
    newMember,
    youAddedMember,
    addedYou,
    addedMember,
    memberLeft,
    youRemovedMember,
    removedYou,
    removedMember,
    memberBanned,
    youBannedMember,
    bannedYou,
    bannedMember,
    youCreatedGroup,
    createdGroup,
    canChatWithYou,
    youReactedToYourMessage,
    youReactedToMessage,
    reactedToMessage,
    reactedMemberMessage,
    mentionedYou,
    youMentioned,
    messageMention,
    messageYourself,
    messageWithAttachment,
    attachmentPhoto,
    attachmentVideo,
    attachmentPhotos,
    attachmentVideos,
    attachmentPhotoAndVideo,
    noPreview,
    canNoLongerInteract,
    noMessage,
    deletedChat,
    savedMessages,
    unreadMessages,
    isTyping,
    userTyping,
    twoUsersTyping,
    threeUsersTyping,
    multipleTyping,
  } = t();

  const typingText = !!typing.typingUsers.length
    ? !room.isGroup
      ? isTyping
      : typing.typingUsers.length === 1
        ? userTyping
        : typing.typingUsers.length === 2
          ? twoUsersTyping
              .replace(
                "[name]",
                typing.typingUsers[0].displayName.split(" ")[0] || appUser,
              )
              .replace(
                "[name]",
                typing.typingUsers[1].displayName.split(" ")[0] || appUser,
              )
          : typing.typingUsers.length === 3
            ? threeUsersTyping
                .replace(
                  "[name]",
                  typing.typingUsers[0].displayName.split(" ")[0] || appUser,
                )
                .replace(
                  "[name]",
                  typing.typingUsers[1].displayName.split(" ")[0] || appUser,
                )
                .replace(
                  "[name]",
                  typing.typingUsers[2].displayName.split(" ")[0] || appUser,
                )
            : multipleTyping
                .replace(
                  "[names]",
                  typing.typingUsers[0].displayName.split(" ")[0] || appUser,
                )
                .replace(
                  "[name]",
                  typing.typingUsers[1].displayName.split(" ")[0],
                )
                .replace("[count]", (typing.typingUsers.length - 2).toString())
    : "";
  const { startNavigation: navigate } = useProgress();

  const queryKey: QueryKey = ["room", "unread", room.id];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance
        .get(`/api/messages/rooms/${room.id}/unread-count`)
        .json<NotificationCountInfo>(),
    initialData: { unreadCount: 0 },
  });

  const { unreadCount } = data;
  const isSaved = room.id === `saved-${loggedinUser.id}`;

  const currentUser = room.members.find(
    (member) => member.userId === loggedinUser.id,
  )?.user
    ? {
        ...room.members.find((member) => member.userId === loggedinUser.id)
          ?.user,
        ...loggedinUser,
        name: savedMessages,
        dissplayName: savedMessages,
      }
    : {
        ...loggedinUser,
        name: savedMessages,
        displayName: savedMessages,
      };

  const messagePreview = room?.messages[0] || {
    id: "",
    content: "",
    senderId: null,
    sender: null,
    roomId: room.id,
    type: "CLEAR",
    createdAt: Date.now(),
  };
  // Check if current user is mentioned in the last message
  const isMentionedInLastMessage = 
    messagePreview.type === "CONTENT" &&
    Array.isArray((messagePreview as Record<string, any>).mentions) &&
    (messagePreview as Record<string, any>).mentions.some((m: any) => m.mentionedId === loggedinUser.id);


  const otherUser: UserData | null = (isSaved || isMentionedInLastMessage)
    ? currentUser
    : room?.members?.filter((member) => member.userId !== loggedinUser.id)[0]
        .user;

  const expiresAt = otherUser?.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified =
    (isSaved ? !!otherUser?.verified[0] : !!otherUser?.verified[0]) &&
    !expired &&
    !room.isGroup;
  const verifiedType: VerifiedType | undefined = isVerified
    ? otherUser?.verified[0].type || "STANDARD"
    : undefined;

  const verifiedCheck = isVerified ? (
    <Verified type={verifiedType} prompt={false} />
  ) : null;
  
  

  let messageType: MessageType = messagePreview?.type;
  const isSender = messagePreview.sender?.id === loggedinUser.id;
  const isRecipient = (isMentionedInLastMessage || messagePreview.recipient?.id === loggedinUser.id);
  const currentMember = room.members.find(
    (member) => member.userId === loggedinUser.id,
  );

  const otherUserFirstName = otherUser?.displayName.split(" ")[0] || appUser;
  const senderFirstName =
    messagePreview.sender?.displayName.split(" ")[0] || appUser;
  const recipientFirstName = isRecipient ? you : (messagePreview.recipient?.displayName.split(" ")[0] || appUser);

  const sender = isSender
    ? you
    : room.isGroup
      ? senderFirstName
      : otherUserFirstName;
  const recipient = room?.messages[0]?.recipient || null;
  let newMemberMsg, oldMemberMsg;
  const memberName = recipient?.displayName.split(" ")[0] || appUser;

  if (recipient && room.isGroup) {
    // Check if message type is info of added member
    if (messageType === "NEWMEMBER") {
      newMemberMsg = newMember.replace("[name]", memberName);
      if (room?.messages[0].sender) {
        room?.messages[0].sender.id === loggedinUser.id
          ? (newMemberMsg = youAddedMember.replace("[name]", memberName))
          : (newMemberMsg =
              recipient.id === loggedinUser.id
                ? addedYou.replace("[name]", sender || appUser)
                : addedMember
                    .replace("[name]", sender || appUser)
                    .replace("[member]", memberName));
      }
    }
    if (messageType === "LEAVE") {
      oldMemberMsg = memberLeft.replace("[name]", memberName);
      if (room?.messages[0].sender) {
        room?.messages[0].sender.id === loggedinUser.id
          ? (oldMemberMsg = youRemovedMember.replace("[name]", memberName))
          : (oldMemberMsg =
              recipient.id === loggedinUser.id
                ? removedYou.replace("[name]", sender || appUser)
                : removedMember
                    .replace("[name]", sender || appUser)
                    .replace("[member]", memberName));
      }
    }
    if (messageType === "BAN") {
      oldMemberMsg = memberBanned.replace("[name]", memberName);
      if (room?.messages[0].sender) {
        room?.messages[0].sender.id === loggedinUser.id
          ? (oldMemberMsg = youBannedMember.replace("[name]", memberName))
          : (oldMemberMsg =
              recipient.id === loggedinUser.id
                ? bannedYou.replace("[name]", sender || appUser)
                : bannedMember
                    .replace("[name]", sender || appUser)
                    .replace("[member]", memberName));
      }
    }
  }
  const showUserPreview = room.isGroup || isSender;
  
  // Helper function to get attachment info with icon
  const getAttachmentPreview = () => {
    const attachments = messagePreview.attachments || [];
    if (attachments.length === 0) return null;
    
    const imageCount = attachments.filter((a) => a.type === "IMAGE").length;
    const videoCount = attachments.filter((a) => a.type === "VIDEO").length;
    const hasContent = messagePreview.content?.trim().length > 0;
    
    let icon = null;
    let label = "";
    let displayType = "contentWithAttachment"; // "contentWithAttachment" or "attachmentOnly"
    
    // Determine icon
    if (imageCount > 0 && videoCount === 0) {
      icon = <ImageIcon size={16} className="flex-shrink-0" />;
    } else if (videoCount > 0 && imageCount === 0) {
      icon = <VideoIcon size={16} className="flex-shrink-0" />;
    } else if (imageCount > 0 && videoCount > 0) {
      icon = <ImageIcon size={16} className="flex-shrink-0" />;
    }
    
    // Determine label and display type
    if (!hasContent) {
      displayType = "attachmentOnly";
      
      if (imageCount > 0 && videoCount === 0) {
        if (imageCount === 1) {
          label = attachmentPhoto;
        } else {
          label = attachmentPhotos.replace("[count]", imageCount.toString());
        }
      } else if (videoCount > 0 && imageCount === 0) {
        if (videoCount === 1) {
          label = attachmentVideo;
        } else {
          label = attachmentVideos.replace("[count]", videoCount.toString());
        }
      } else if (imageCount > 0 && videoCount > 0) {
        label = attachmentPhotoAndVideo
          .replace("[photoCount]", imageCount.toString())
          .replace("[videoCount]", videoCount.toString());
      }
    }
    
    return { icon, label, displayType };
  };

  const reactionContent = (isSender
      ? recipient?.id === loggedinUser.id
        ? youReactedToYourMessage.replace("[name]", sender || appUser)
        : youReactedToMessage
            .replace("[name]", sender || appUser)
            .replace("[member]", recipientFirstName || appUser)
      : recipient?.id === loggedinUser.id
        ? reactedToMessage.replace("[name]", sender || appUser)
        : reactedMemberMessage
            .replace("[name]", sender || appUser)
            .replace("[member]", recipientFirstName || appUser))

  const mentionContent = isSender ? youMentioned.replace("[member]", recipientFirstName || appUser)
        : isRecipient ? mentionedYou.replace("[name]", sender || appUser)
        : messageMention
            .replace("[name]", sender || appUser)
            .replace("[member]", recipientFirstName || appUser)
  const textContent = `${showUserPreview ? sender || appUser : ""}${showUserPreview ? ": " : ""}${messagePreview.content.length > 100 ? messagePreview.content.slice(0, 100) : messagePreview.content}`

  const defaultContent = isMentionedInLastMessage && unreadCount ? mentionContent : textContent
  
  const attachmentPreview = getAttachmentPreview();
  
  const contentsTypes = {
    CREATE: room.isGroup
      ? messagePreview.sender?.id === loggedinUser.id
        ? youCreatedGroup.replace("[name]", sender || appUser)
        : createdGroup.replace("[name]", sender || appUser)
      : canChatWithYou.replace("[name]", otherUserFirstName || appUser),
    CONTENT: defaultContent,
    CLEAR: noPreview,
    DELETE: deletedChat,
    SAVED: messageYourself,
    NEWMEMBER: newMemberMsg,
    LEAVE: oldMemberMsg,
    BAN: oldMemberMsg,
    REACTION: reactionContent,
    MENTION: mentionContent,
  };

  let messagePreviewContent = unreadCount > 1 
    ? unreadMessages.replace("[count]", unreadCount.toString())
    : contentsTypes[messageType];
  let showIconBefore = false;
  let showIconAfterSender = false;
  let mentionIndicator = false;

  // If user is mentioned in CONTENT message, show mention indicator (only when not showing unread count)
  if (isMentionedInLastMessage && !isSender && unreadCount <= 1) {
    mentionIndicator = true;
  }

  // Check if message has attachments (only when not showing unread count)
  if (unreadCount <= 1 && messagePreview.attachments && messagePreview.attachments.length > 0 && attachmentPreview && messageType === "CONTENT") {
    if (messagePreview.content?.trim().length > 0) {
      // Has content + attachments: show content with icon before (icon will be added in JSX)
      messagePreviewContent = contentsTypes.CONTENT;
      showIconBefore = true;
    } else {
      // No content but has attachments: show sender + attachment label
      const prefix = showUserPreview ? `${sender}: ` : "";
      messagePreviewContent = prefix + attachmentPreview.label;
      showIconAfterSender = true;
    }
  }

  if (currentMember?.type === "OLD" || currentMember?.type === "BANNED") {
    messagePreviewContent = canNoLongerInteract;
    messageType = "CLEAR";
  }

  const select = async () => {
    onSelect();
    navigate("/messages/chat");
  };

  const chatName = room.name ||
      `${otherUser?.displayName || appUser} ${isSaved ? `(${you})` : ""}` ||
      (room.isGroup ? groupChat : appUser);

  // Convert mentions in title from @[DisplayName](userId) to @DisplayName
  const titleContent = messagePreviewContent?.replace("[r]", messagePreview.content) || noMessage;
  const titleContentWithMentions = titleContent.replace(/\n/g, " ").replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "@$1");

  return (
    <li
      key={room.id}
      className={`cursor-pointer p-2 ${active && "bg-accent/50"}`}
      onClick={select}
      title={titleContentWithMentions}
    >
      <div className="flex items-center gap-2">
        {room.isGroup ? (
          <GroupAvatar size={45} avatarUrl={room.groupAvatarUrl} />
        ) : (
          <UserAvatar
            userId={otherUser?.id || ""}
            avatarUrl={otherUser?.avatarUrl}
            size={45}
            hideBadge={false}
          />
        )}
        <div className="flex-1 overflow-hidden">
          <span
            className={cn(
              "block truncate",
              isVerified && "flex items-center",
              (unreadCount && !typing.isTyping) && "font-semibold",
            )}
          >
            {/* Surbrillance dans le nom */}
            <HighlightText text={chatName} highlight={highlight} />
            {verifiedCheck}
          </span>
          <div className={cn("flex w-full items-center gap-1 text-sm text-muted-foreground", (unreadCount && !typing.isTyping) && "font-semibold text-primary",)}>
            {showIconBefore && attachmentPreview?.icon && (
              <span className="flex-shrink-0 text-muted-foreground">
                {attachmentPreview.icon}
              </span>
            )}
            <span
              className={cn(
                "line-clamp-2 text-ellipsis break-all flex items-center gap-1",
                (messageType !== "CONTENT" || typing.isTyping) &&
                  "text-xs text-primary",
                typing.isTyping && "animate-pulse",
              )}
            >
              {typing.isTyping
                ? typingText
                : showIconAfterSender && messagePreviewContent && messagePreviewContent.includes(": ")
                  ? (
                    <>
                      {messagePreviewContent.substring(0, messagePreviewContent.indexOf(": ") + 2)}
                      {attachmentPreview?.icon && <span className="flex-shrink-0 text-muted-foreground">{attachmentPreview.icon}</span>}
                      {messagePreviewContent.substring(messagePreviewContent.indexOf(": ") + 2)}
                    </>
                  )
                  : (messagePreviewContent &&
                    (messageType === "REACTION" ? (
                      <>
                        {messagePreviewContent.split("[r]")[0]}
                        <span className="font-emoji">
                          {messagePreview.content}
                        </span>
                        {messagePreviewContent.split("[r]")[1]}
                      </>
                    ) : /* Surbrillance dans le dernier message si c'est du texte */
                    (messageType === "CONTENT") ? (
                      <HighlightText
                        text={messagePreviewContent}
                        highlight={highlight}
                      />
                    ) : (
                      messagePreviewContent
                    ))) ||
                  noMessage}
            </span>
            {!typing.isTyping && (
              <>
                <span className="flex-shrink-0">•</span>
                <span className="line-clamp-1 min-w-fit flex-shrink-0 text-sm">
                  <Time time={messagePreview.createdAt} full={false} />
                </span>
              </>
            )}
          </div>
        </div>
        {!!unreadCount && (
          <div className="flex flex-col items-center justify-between gap-2">
          {mentionIndicator && (
              <span className={cn("flex-shrink-0 text-inherit font-bold", unreadCount && "text-primary")}>
                <AtSign size={14} />
              </span>
            )}
          <div className="flex items-center rounded-2xl p-1 px-2 text-xs bg-primary text-white"><FormattedInt number={unreadCount} /></div>
          </div>
        )}
      </div>
    </li>
  );
}