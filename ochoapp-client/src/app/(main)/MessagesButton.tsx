"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { NotificationCountInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleMore } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { usePathname } from "next/navigation";

interface MessagesButtonProps {
  initialState: NotificationCountInfo;
  className?: string;
}

export default function MessagesButton({
  initialState,
  className,
}: MessagesButtonProps) {
  const isProduction = process.env.NODE_ENV === "production";
  const pathname = usePathname();
  const isMessagesPage = pathname.startsWith("/messages");

      const {
        messages,
      } = t();

  const { data } = useQuery({
    queryKey: ["unread-chat-messages"],
    queryFn: () =>
      kyInstance
        .get("/api/messages/unread-count")
        .json<NotificationCountInfo>(),
    initialData: initialState,
    refetchInterval: isProduction ? 45 * 1000 : 50 * 1000,
  });

  const { unreadCount } = data;

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex items-center justify-start max-sm:h-fit max-sm:flex-1 max-sm:p-1.5 sm:gap-3",
        className,
      )}
      title={messages}
      asChild
    >
      <OchoLink
        href="/messages"
        className={cn("items-center max-sm:flex max-sm:flex-col text-inherit", className)}
      >
        <div className="relative">
          <MessageCircleMore />
          {!!unreadCount && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#dc143c] border-background border-[1px] px-1 text-xs font-medium tabular-nums text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-xs sm:hidden">{messages}</span>
        <span className={cn("max-lg:hidden", isMessagesPage && "hidden")}>{messages}</span>
      </OchoLink>
    </Button>
  );
}
