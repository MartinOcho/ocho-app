"use client";

import Image, { StaticImageData } from "next/image";
import avatarPlaceholder from "@/assets/avatar-placeholder.png";
import { cn } from "@/lib/utils";
import { UsersRound } from "lucide-react";
import { useState } from "react";

interface GroupAvatarProps {
  avatarUrl?: string | StaticImageData | null | undefined;
  size?: number;
  className?: string;
}

export default function GroupAvatar({
  avatarUrl,
  size = 48,
  className,
}: GroupAvatarProps) {
  const [isImageErr, setIsImageErr] = useState(false);
return <span
    className={cn(
      `relative flex aspect-square h-fit min-h-fit w-fit min-w-fit items-center justify-center rounded-full bg-muted`,
      className,
    )}
  >
    <UsersRound
      className={cn(
        "absolute left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%] rounded-full text-muted-foreground max-w-[60%] max-h-[60%] fill-muted-foreground",
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
      onError={() => setIsImageErr(true)}
    />
  </span>;
}
