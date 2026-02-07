"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { MessageCircleMore } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { usePathname } from "next/navigation";
import { useSocket } from "@/components/providers/SocketProvider";

interface MessagesButtonProps {
  className?: string;
}

export default function MessagesButton({
  className,
}: MessagesButtonProps) {
  const pathname = usePathname();
  const isMessagesPage = pathname.startsWith("/messages");
  
  // Récupérer le compte non-lu des messages via socket
  const { messagesUnread } = useSocket();;

  const unreadCount = typeof messagesUnread === "number" ? messagesUnread : 0;

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex items-center justify-start max-sm:h-fit max-sm:flex-1 max-sm:p-1.5 sm:gap-3",
        className,
      )}
      title={t("messages")}
      asChild
    >
      <OchoLink
        href="/messages"
        className={cn("items-center max-sm:flex max-sm:flex-col text-inherit", className)}
      >
        <div className="relative">
          <MessageCircleMore />
          {!!unreadCount && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#dc143c] border-background border-[1px] px-1 text-xs font-medium tabular-nums text-white animate-in zoom-in duration-300">
              {unreadCount > 15 ? "15+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[0.65rem] max-sm:font-normal sm:hidden">{t("messages")}</span>
        <span className={cn("max-lg:hidden", isMessagesPage && "hidden")}>{t("messages")}</span>
      </OchoLink>
    </Button>
  );
}