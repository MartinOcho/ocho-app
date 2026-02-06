"use client";

import { RoomFooterState, RoomFooterStateType } from "@/lib/types";
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
  onMessageSend: (content: string) => void;
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
  switch (state.type) {
    case RoomFooterStateType.Loading:
      return <LoadingFooter />;

    case RoomFooterStateType.Normal:
      return (
        <MessageFormComponent
          expanded={messageInputExpanded}
          onExpanded={onExpandedChange}
          onSubmit={onMessageSend}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
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
