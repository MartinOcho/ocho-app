import { PostData } from "@/lib/types";
import { useDeletePostMutation } from "./mutations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import LoadingButton from "../LoadingButton";
import { Button } from "../ui/button";
import { VocabularyKey } from "@/lib/vocabulary";
import { useTranslation } from "@/context/LanguageContext";

interface DeletePostDialogProps {
  post: PostData;
  open: boolean;
  onClose: () => void;
}

export default function DeletePostDialog({
  post,
  open,
  onClose,
}: DeletePostDialogProps) {
  const mutation = useDeletePostMutation();

  const { t } = useTranslation();

  const { delete: deleteText, cancel, deleteConfirmPrompt } = t();

  function handleOpenChange(open: boolean) {
    if (!open || !mutation.isPending) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deleteText}</DialogTitle>
          <DialogDescription>{deleteConfirmPrompt}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <LoadingButton
            variant="destructive"
            onClick={() => mutation.mutate(post.id, { onSuccess: onClose })}
            loading={mutation.isPending}
          >
            {deleteText}
          </LoadingButton>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            {cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
