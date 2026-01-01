import { RoomData } from "@/lib/types";
import LoadingButton from "../LoadingButton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";
import { useRestoreMemberMutation } from "./mutations";
import { t } from "@/context/LanguageContext";

interface RestoreMemberButtonProps {
  memberId: string;
  room: RoomData;
  children: React.ReactNode;
}

export default function RestoreMemberButton({
  memberId,
  room,
  children,
}: RestoreMemberButtonProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { groupRestoreSuccess } = t()

  const mutation = useRestoreMemberMutation();
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
            description: groupRestoreSuccess
            .replace("[name]", member?.user?.displayName || "un utilisateur")
            .replace("[group]", room.name || "ce groupe"),
          });
        },
        onError(error) {
          console.error(error);
        },
      },
    );
  }
  return (
    <LoadingButton
      loading={mutation.isPending}
      className="flex w-full justify-center gap-3"
      onClick={handleSubmit}
    >
      {children}
    </LoadingButton>
  );
}
