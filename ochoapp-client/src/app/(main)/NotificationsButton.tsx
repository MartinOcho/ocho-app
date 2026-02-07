"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { NotificationCountInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VocabularyKey } from "@/lib/vocabulary";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/components/providers/SocketProvider";
import { Bell } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { usePathname } from "next/navigation";

interface NotificationsButtonProps extends ButtonProps {
  initialState: NotificationCountInfo;
  className?: string;
}

export default function NotificationsButton({
  initialState,
  className,
  ...props
}: NotificationsButtonProps) {
  const { activity, activityCenter, notifications } = t();
  const pathname = usePathname();
  const isMessagesPage = pathname.startsWith("/messages");

  const { notificationsUnread } = useSocket();
  const unread = typeof notificationsUnread === "number" ? notificationsUnread : initialState.unreadCount;

  return (
    <Button
      {...props}
      variant="ghost"
      className={cn(
        "flex items-center justify-start max-sm:h-fit max-sm:flex-1 max-sm:p-1.5 sm:gap-3",
        className,
      )}
      title={activityCenter}
      asChild
    >
      <OchoLink
        href="/notifications"
        className={cn("items-center max-sm:flex max-sm:flex-col text-inherit",
          className,
        )}
      >
        <div className="relative">
          <Bell />
          {!!unread && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#dc143c] border-background border-[1px] px-1 text-xs font-medium tabular-nums text-white">
              {unread}
            </span>
          )}
        </div>
        <span className="text-[0.65rem] max-sm:font-normal sm:hidden">{activity}</span>
        <span className={cn("max-lg:hidden", isMessagesPage && "hidden")}>{notifications}</span>
      </OchoLink>
    </Button>
  );
}
