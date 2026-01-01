import { MessageData } from "@/lib/types";
import { useDeleteMessageMutation } from "./mutations";
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

interface DeleteCommentDialogProps {
  message: MessageData;
  open: boolean;
  onClose: () => void;
}

export default function DeleteCommentDialog({
  message,
  open,
  onClose,
}: DeleteCommentDialogProps) {
  const mutation = useDeleteMessageMutation();

  function handleOpenChange(open: boolean) {
    if (!open || !mutation.isPending) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer ?</DialogTitle>
          <DialogDescription>
            Voulez-vous vraiment supprimer ce message ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <LoadingButton
            variant="destructive"
            onClick={()=>mutation.mutate(message.id, {onSuccess: onClose})}
            loading={mutation.isPending}
            >Supprimer</LoadingButton>
            <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={mutation.isPending}
            >Annuler</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}