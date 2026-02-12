"use client";

import { RoomFooterState, RoomFooterStateType, MentionedUser, LocalAttachment } from "@/lib/types";
import { MessageFormComponent } from "./MessageFormComponent";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Ban, ChevronUp, Ghost, Lock, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/context/LanguageContext";

interface RoomFooterProps {
  state: RoomFooterState;
  roomId: string;
  onMessageSend: (content: string, attachmentIds?: string[], attachments?: LocalAttachment[], mentionedUsers?: MentionedUser[]) => void;
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
  onContentChange?: (hasContent: boolean) => void;
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
  onContentChange,
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
          onContentChange={onContentChange}
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


// Footerstates
interface UnavailableFooterProps {
  stateText: string;
  buttonLabel: string;
  onButtonClick?: () => void;
  buttonColor?: string;
  textColor?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function UnavailableFooter({
  stateText,
  buttonLabel,
  onButtonClick,
  buttonColor,
  textColor,
  icon,
  compact = false,
}: UnavailableFooterProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "relative z-20 flex w-fit items-end gap-1 rounded-full border border-input bg-background p-1 ring-primary ring-offset-background transition-[width] duration-75 has-[button:focus-visible]:outline-none has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring has-[button:focus-visible]:ring-offset-2",
          "aspect-square rounded-full",
        )}
      >
        <button
          type="button"
          onClick={onButtonClick}
          className="flex h-10 w-10 items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {icon || <AlertTriangle className="h-5 w-5 text-destructive" />}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-1 select-none items-center justify-center gap-3 flex-col">
      {buttonLabel && (
        <div className="flex flex-col items-center gap-2"> 
        <Button
          onClick={onButtonClick}
          className={cn("flex-shrink-0 rounded-full", buttonColor && `bg-[${buttonColor}]`)}
          variant="destructive"
          size="icon"
        >
          <ChevronUp/>
        </Button>
        <div className="animate-bounce text-sm">{buttonLabel}</div>
        </div>
       
      )}
      <div className="flex items-center justify-center flex-1 gap-2 rounded-3xl border border-destructive/30 bg-destructive/5 p-3 sm:px-5">
        {icon || <AlertTriangle className="h-5 w-5 text-destructive" />}
        <p className="text-center font-semibold text-destructive">
          {stateText}
        </p>
      </div>
    </div>
  );
}

interface LoadingFooterProps {
  onClose?: () => void;
  compact?: boolean;
}

export function LoadingFooter({
  onClose,
  compact = false,
}: LoadingFooterProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "relative z-20 flex w-fit items-end gap-1 rounded-full border border-input bg-background p-1 ring-primary ring-offset-background transition-[width] duration-75",
          "aspect-square animate-pulse rounded-full",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full">
          <div className="h-4 w-4 rounded-full bg-muted-foreground/50"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex w-full animate-pulse select-none items-center justify-center gap-2 rounded-3xl border border-input bg-background/50 p-3 px-5">
      <div className="h-4 w-4 rounded-full bg-muted-foreground/50"></div>
      <p className="text-center font-semibold text-muted-foreground">
        Chargement...
      </p>
    </div>
  );
}

interface UserLeftFooterProps {
  onContactAdmin?: () => void;
  compact?: boolean;
}

export function UserLeftFooter({
  onContactAdmin,
  compact = false,
}: UserLeftFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("youLeftGroup")}
      buttonLabel={t("contactAdmin")}
      onButtonClick={onContactAdmin}
      icon={<LogOut className="h-5 w-5 text-orange-500" />}
      compact={compact}
    />
  );
}

export const UserLeftIcon = <LogOut className="h-5 w-5 text-orange-500" />;

interface UserKickedFooterProps {
  onContactAdmin?: () => void;
  compact?: boolean;
}

export function UserKickedFooter({
  onContactAdmin,
  compact = false,
}: UserKickedFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("youWereKickedFromGroup")}
      buttonLabel={t("contactAdmin")}
      onButtonClick={onContactAdmin}
      icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
      compact={compact}
    />
  );
}

export const UserKickedIcon = (
  <AlertTriangle className="h-5 w-5 text-orange-500" />
);

interface UserDeletedFooterProps {
  onDeleteConversation?: () => void;
  compact?: boolean;
}

export function UserDeletedFooter({
  onDeleteConversation,
  compact = false,
}: UserDeletedFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("deletedAccount")}
      buttonLabel={t("deleteConversation")}
      onButtonClick={onDeleteConversation}
      icon={<Ghost className="h-5 w-5 text-red-500" />}
      compact={compact}
    />
  );
}

export const UserDeletedIcon = <Ghost className="h-5 w-5 text-red-500" />;

interface UserBannedFooterProps {
  onContactSupport?: () => void;
  compact?: boolean;
}

export function UserBannedFooter({
  onContactSupport,
  compact = false,
}: UserBannedFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("youAreBanned")}
      buttonLabel={t("contactSupport")}
      onButtonClick={onContactSupport}
      icon={<Ban className="h-5 w-5 text-destructive" />}
      compact={compact}
    />
  );
}

export const UserBannedIcon = <Ban className="h-5 w-5 text-destructive" />;

interface PrivateProfileFooterProps {
  onFollowUser?: () => void;
  compact?: boolean;
}

export function PrivateProfileFooter({
  onFollowUser,
  compact = false,
}: PrivateProfileFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("privateProfile")}
      buttonLabel={t("followToChat")}
      onButtonClick={onFollowUser}
      icon={<Lock className="h-5 w-5 text-pink-500" />}
      compact={compact}
    />
  );
}

export const PrivateProfileIcon = <Lock className="h-5 w-5 text-pink-500" />;

interface GroupFullFooterProps {
  onViewDetails?: () => void;
  compact?: boolean;
}

export function GroupFullFooter({
  onViewDetails,
  compact = false,
}: GroupFullFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("groupFull")}
      buttonLabel={t("viewDetails")}
      onButtonClick={onViewDetails}
      icon={<Users className="h-5 w-5 text-yellow-500" />}
      compact={compact}
    />
  );
}

export const GroupFullIcon = <Users className="h-5 w-5 text-yellow-500" />;

interface UnspecifiedFooterProps {
  onContactSupport?: () => void;
  compact?: boolean;
}

export function UnspecifiedFooter({
  onContactSupport,
  compact = false,
}: UnspecifiedFooterProps) {
  const {t} = useTranslation();
  return (
    <UnavailableFooter
      stateText={t("cantMessage")}
      buttonLabel={t("contactSupport")}
      onButtonClick={onContactSupport}
      icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
      compact={compact}
    />
  );
}

export const UnspecifiedIcon = (
  <AlertCircle className="h-5 w-5 text-muted-foreground" />
);