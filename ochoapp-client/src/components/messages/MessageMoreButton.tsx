import { MessageData } from "@/lib/types";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Copy, MoreVertical, Smile, Trash2 } from "lucide-react";
import DeleteMessageDialog from "./DeleteMessageDialog";
import { cn } from "@/lib/utils";
import { useSession } from "@/app/(main)/SessionProvider";
import { useToast } from "../ui/use-toast";
import { t } from "@/context/LanguageContext";

interface MessageMoreButtonProps {
  message: MessageData;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onReactOpen?: () => void;
  canReact: boolean;
}

export default function MessageMoreButton({
  message,
  className,
  open = false,
  onReactOpen,
  onOpenChange,
  canReact,
}: MessageMoreButtonProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { user: loggedinUser } = useSession();
  const { toast } = useToast();
  const {
    reactText,
    copy,
    messageCopied,
    unableToCopyMessage,
    delete: deleteText,
  } = t();

  if (!loggedinUser) {
    return null;
  }

  const isOwner = loggedinUser.id === message.senderId;

  // Fonction pour copier le contenu du message dans le presse-papiers
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        description: messageCopied,
      });
    } catch (error) {
      console.error(unableToCopyMessage, error);
      toast({
        variant: "destructive",
        description: unableToCopyMessage,
      });
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <div
            className={cn("flex size-8 rounded-full cursor-pointer justify-center items-center hover:bg-muted/50", className)}
          >
            <MoreVertical className="size-5 text-muted-foreground" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canReact && (
            <DropdownMenuItem onClick={onReactOpen}>
              <span className="flex items-center gap-3">
                <Smile className="size-4" />
                {reactText}
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={copyToClipboard}>
            <span className="flex items-center gap-3">
              <Copy className="size-4" />
              {copy}
            </span>
          </DropdownMenuItem>

          {isOwner && (
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
              <span className="flex items-center gap-3 text-destructive">
                <Trash2 className="size-4" />
                {deleteText}
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteMessageDialog
        message={message}
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
