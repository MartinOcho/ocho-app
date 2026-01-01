"use client";

import Image, { StaticImageData } from "next/image";
import avatarPlaceholder from "@/assets/avatar-placeholder.png";
import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";
import { useSocket } from "./providers/SocketProvider";

interface UserAvatarProps {
  userId: string | null;
  avatarUrl: string | StaticImageData | null | undefined;
  size?: number;
  className?: string;
  hideBadge?: boolean;
}

export default function UserAvatar({
  userId,
  avatarUrl,
  size = 48,
  className,
  hideBadge = true,
}: UserAvatarProps) {
  let isImageErr = false;
  const {checkUserStatus, onlineStatus} = useSocket();
  const status = onlineStatus[userId || ""];
  !status && !hideBadge && checkUserStatus(userId || "");
  
  const online = status?.isOnline;
  return (
    <span
      className={cn(
        `relative flex aspect-square h-fit min-h-fit w-fit min-w-fit items-center justify-center rounded-full bg-muted`,
        className,
      )}
    >
      <UserRound
        className={cn(
          "absolute left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%] rounded-full text-muted-foreground",
          avatarUrl && "pointer-events-none opacity-0",
        )}
        size={size > 32 ? size - 16 : size - 4}
      />
      <Image
        src={avatarUrl ?? avatarPlaceholder}
        alt=""
        className={cn(
          "aspect-square h-fit flex-none rounded-full bg-secondary object-cover",
          (!avatarUrl || isImageErr) && "pointer-events-none opacity-0",
          `max-w-[${size}px] min-w-[${size}px] max-h-[${size}px] min-h-[${size}px]`,
        )}
        width={size}
        height={size}
        onError={() => {
          isImageErr = true;
        }}
      />
      {(online && !hideBadge) && (
        <div className="absolute bottom-0 right-0 aspect-square size-3 rounded-full border-2 border-solid border-background bg-primary" />
      )}
    </span>
  );
}
