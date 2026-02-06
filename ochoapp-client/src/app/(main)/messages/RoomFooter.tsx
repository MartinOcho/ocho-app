"use client";

import { RoomFooterState, RoomFooterStateType, MessageAttachment } from "@/lib/types";
import {
  LoadingFooter,
  UnavailableFooter,
  UserLeftFooter,
  UserKickedFooter,
  UserDeletedFooter,
  UserBannedFooter,
  PrivateProfileFooter,
  GroupFullFooter,
  UnspecifiedFooter,
  UserLeftIcon,
  UserKickedIcon,
  UserDeletedIcon,
  UserBannedIcon,
  PrivateProfileIcon,
  GroupFullIcon,
  UnspecifiedIcon,
} from "./FooterStates";
import { MessageFormComponent } from "./MessageFormComponent";

interface RoomFooterProps {
  state: RoomFooterState;
  roomId: string;
  onMessageSend: (content: string, attachments?: MessageAttachment[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  messageInputExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  // Optional callbacks for button actions
  onContactSupport?: () => void;
  onContactAdmin?: () => void;
  onDeleteConversation?: () => void;
  onFollowUser?: () => void;
  onViewGroupDetails?: () => void;
}

export default function RoomFooter({
  state,
  roomId,
  onMessageSend,
  onTypingStart,
  onTypingStop,
  messageInputExpanded,
  onExpandedChange,
  onContactSupport,
  onContactAdmin,
  onDeleteConversation,
  onFollowUser,
  onViewGroupDetails,
}: RoomFooterProps) {
  // Mode compact: afficher seulement les icônes
  if (!messageInputExpanded) {
    switch (state.type) {
      case RoomFooterStateType.Loading:
        return <div className="size-12 rounded-full p-2 text-muted-foreground animate-pulse" />;
      case RoomFooterStateType.Normal:
        return (
          <MessageFormComponent
            expanded={false}
            onExpanded={onExpandedChange}
            onSubmit={onMessageSend}
            onTypingStart={onTypingStart}
            onTypingStop={onTypingStop}
            canAttach={true}
          />
        );
      case RoomFooterStateType.UserLeft:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-orange-500">{UserLeftIcon}</div>;
      case RoomFooterStateType.UserKicked:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-orange-500">{UserKickedIcon}</div>;
      case RoomFooterStateType.UserDeleted:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-red-500">{UserDeletedIcon}</div>;
      case RoomFooterStateType.UserBanned:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-destructive">{UserBannedIcon}</div>;
      case RoomFooterStateType.PrivateProfile:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-pink-500">{PrivateProfileIcon}</div>;
      case RoomFooterStateType.GroupFull:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-yellow-500">{GroupFullIcon}</div>;
      case RoomFooterStateType.Unspecified:
      default:
        return <div className="size-12 rounded-full p-2 flex items-center justify-center text-muted-foreground">{UnspecifiedIcon}</div>;
    }
  }

  // Mode normal: afficher le contenu complet
  switch (state.type) {
    case RoomFooterStateType.Loading:
      return <LoadingFooter />;

    case RoomFooterStateType.Normal:
      return (
        <MessageFormComponent
          expanded={!messageInputExpanded}
          onExpanded={onExpandedChange}
          onSubmit={onMessageSend}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          canAttach={true}
        />
      );

    case RoomFooterStateType.UserLeft:
      return <UserLeftFooter onContactAdmin={onContactAdmin} />;

    case RoomFooterStateType.UserKicked:
      return <UserKickedFooter onContactAdmin={onContactAdmin} />;

    case RoomFooterStateType.UserDeleted:
      return <UserDeletedFooter onDeleteConversation={onDeleteConversation} />;

    case RoomFooterStateType.UserBanned:
      return <UserBannedFooter onContactSupport={onContactSupport} />;

    case RoomFooterStateType.PrivateProfile:
      return <PrivateProfileFooter onFollowUser={onFollowUser} />;

    case RoomFooterStateType.GroupFull:
      return <GroupFullFooter onViewDetails={onViewGroupDetails} />;

    case RoomFooterStateType.Unspecified:
    default:
      return <UnspecifiedFooter onContactSupport={onContactSupport} />;
  }
}
