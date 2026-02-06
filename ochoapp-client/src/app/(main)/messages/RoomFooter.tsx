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
  const compact = !messageInputExpanded;

  switch (state.type) {
    case RoomFooterStateType.Loading:
      return <LoadingFooter compact={compact} />;

    case RoomFooterStateType.Normal:
      return (
        <MessageFormComponent
          expanded={!compact}
          onExpanded={onExpandedChange}
          onSubmit={onMessageSend}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          canAttach={true}
        />
      );

    case RoomFooterStateType.UserLeft:
      return <UserLeftFooter onContactAdmin={onContactAdmin} compact={compact} />;

    case RoomFooterStateType.UserKicked:
      return <UserKickedFooter onContactAdmin={onContactAdmin} compact={compact} />;

    case RoomFooterStateType.UserDeleted:
      return <UserDeletedFooter onDeleteConversation={onDeleteConversation} compact={compact} />;

    case RoomFooterStateType.UserBanned:
      return <UserBannedFooter onContactSupport={onContactSupport} compact={compact} />;

    case RoomFooterStateType.PrivateProfile:
      return <PrivateProfileFooter onFollowUser={onFollowUser} compact={compact} />;

    case RoomFooterStateType.GroupFull:
      return <GroupFullFooter onViewDetails={onViewGroupDetails} compact={compact} />;

    case RoomFooterStateType.Unspecified:
    default:
      return <UnspecifiedFooter onContactSupport={onContactSupport} compact={compact} />;
  }
}