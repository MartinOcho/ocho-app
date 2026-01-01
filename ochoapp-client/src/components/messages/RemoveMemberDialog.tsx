import { RoomData } from "@/lib/types";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { LogOut } from "lucide-react";
import { useRemoveMemberMutation } from "./mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";
import LoadingButton from "../LoadingButton";
import { t } from "@/context/LanguageContext";

interface RemoveMemberDialogProps {
  memberId: string;
  room: RoomData;
}

export default function RemoveMemberDialog({
  memberId,
  room,
}: RemoveMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const {
    appUser,
    removeFromGroup,
    groupRemovePrompt,
    cancel,
    remove,
    groupRemoveSuccess,
    thisGroup,
  } = t();

  function onClose() {
    setIsOpen(false);
  }

  const mutation = useRemoveMemberMutation();
  const roomId = room.id;

  const member = room.members.find((member) => member.userId === memberId);

  function handleSubmit() {
    mutation.mutate(
      {
        roomId,
        memberId,
      },
      {
        onSuccess: () => {
          const queryKey = ["chat", roomId];

          queryClient.invalidateQueries({ queryKey });

          toast({
            description: groupRemoveSuccess
              .replace("[name]", member?.user?.displayName || appUser)
              .replace("[group]", room.name || thisGroup),
          });
          onClose();
        },
        onError(error) {
          console.error(error);
        },
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex w-full justify-center gap-3">
          <LogOut size={24} />
          {removeFromGroup}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{removeFromGroup}</DialogTitle>
        <p>
          {groupRemovePrompt.replace("[name]", member?.user?.displayName || appUser)
              .replace("[group]", room.name || thisGroup)}
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {cancel}
          </Button>
          <LoadingButton
            loading={mutation.isPending}
            variant="destructive"
            onClick={handleSubmit}
          >
            {remove}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
