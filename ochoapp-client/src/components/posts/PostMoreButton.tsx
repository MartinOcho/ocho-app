import { PostData } from "@/lib/types";
import { useState } from "react";
import DeletePostDialog from "./DeletePostDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Pencil } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";
import EditPostDialog from "./EditPostDialog";

interface PostMoreButtonProps {
  post: PostData;
  className?: string;
}

export default function PostMoreButton({
  post,
  className,
}: PostMoreButtonProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { t } = useTranslation();

  const { delete: deleteText, edit } = t();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className={className}>
            <MoreHorizontal className="size-5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <span className="flex items-center gap-3">
              <Pencil className="size-4" />
              {edit}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
            <span className="flex items-center gap-3 text-destructive">
              <Trash2 className="size-4" />
              {deleteText}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditPostDialog
        post={post}
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
      />
      <DeletePostDialog
        post={post}
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
