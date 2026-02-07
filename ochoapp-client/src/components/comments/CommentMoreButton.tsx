import { CommentData } from "@/lib/types";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { MoreVertical, Trash2 } from "lucide-react";
import DeleteCommentDialog from "./DeleteCommentDialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/context/LanguageContext";

interface CommentMoreButtonProps {
  comment: CommentData;
  className?: string;
  onRemove?: () => void;
}

export default function CommentMoreButton({
  comment,
  className,
  onRemove,
}: CommentMoreButtonProps) {
  const { t } = useTranslation();
  const {delete: deleteText} = t();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className={cn("p-1 ring-1 ring-ring rounded-full aspect-square cursor-pointer", className)}>
            <MoreVertical className="size-5 text-muted-foreground" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
            <span className="flex items-center gap-3 text-destructive">
              <Trash2 className="size-4" />
              {deleteText}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteCommentDialog
        comment={comment}
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
