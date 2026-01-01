import { useSession } from "@/app/(main)/SessionProvider";
import { RoomData } from "@/lib/types";
import { useState } from "react";
import { ShieldBan, ShieldPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAddAdminMutation } from "./mutations";
import LoadingButton from "../LoadingButton";
import { cn } from "@/lib/utils";
import React from "react";
import { MemberType } from "@prisma/client";
import { t } from "@/context/LanguageContext";

interface AdminButtonProps {
  member: string;
  type: MemberType;
  room: RoomData;
}

export default function AdminButton({
  member,
  type,
  room,
}: AdminButtonProps) {
  const [currentType, setCurrentType] = useState<string>(type);
  const queryClient = useQueryClient();

  const { user: loggedInUser } = useSession();
  const { makeGroupAdmin, dismissAsAdmin } = t();

  const roomId = room.id;

  const mutation = useAddAdminMutation();

  const members = room.members;

  //  get the loggedin user values in members
  const loggedMember = members.find(
    (member) => member.userId === loggedInUser.id,
  );

  const isAdmin = currentType === "ADMIN";
  const isLoggedAuthorized =
    type !== "OWNER" &&
    (loggedMember?.type === "ADMIN" || loggedMember?.type === "OWNER");

  function handleSubmit() {
    const initialType = currentType;
    mutation.mutate(
      {
        roomId,
        member,
      },
      {
        onSuccess: ({ newRoomMember }) => {
          if (newRoomMember.type !== initialType) {
            setCurrentType(newRoomMember.type);

            const queryKey = ["chat", roomId];

            queryClient.invalidateQueries({ queryKey });
          }
        },
        onError(error) {
          setCurrentType(initialType);
          console.error(error);
        },
      },
    );
  }
  return (
    isLoggedAuthorized && (
      <LoadingButton
        loading={mutation.isPending}
        variant={isAdmin ? "outline" : "default"}
        className={cn(
          "flex w-full justify-center gap-3",
          !isAdmin && "text-primary-foreground",
        )}
        onClick={handleSubmit}
      >
        {isAdmin ? (
          <>
            <ShieldBan size={24} className="fill-primary-foreground" />{" "}
            {dismissAsAdmin}
          </>
        ) : (
          <>
            <ShieldPlus size={24} /> {makeGroupAdmin}
          </>
        )}
      </LoadingButton>
    )
  );
}
