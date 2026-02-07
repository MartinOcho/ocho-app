import { RoomData, RoomFooterState, RoomFooterStateType } from "@/lib/types";

interface UseRoomFooterStateParams {
  room: RoomData | null | undefined;
  loggedUserId: string | null | undefined;
  isMember: boolean;
  isSaved: boolean;
  otherUser: any | null;
  isLoading: boolean;
}

/**
 * Détermine l'état du footer de la room basé sur les conditions
 * de la room, du membre logé et de la conversation.
 */
export function useRoomFooterState({
  room,
  loggedUserId,
  isMember,
  isSaved,
  otherUser,
  isLoading,
}: UseRoomFooterStateParams): RoomFooterState {
  // État de chargement
  if (isLoading || !room || !loggedUserId) {
    return { type: RoomFooterStateType.Loading };
  }

  // Cas spécial : Messages sauvegardés
  if (isSaved) {
    return { type: RoomFooterStateType.Normal };
  }

  // Si ce n'est pas un groupe (conversation privée)
  if (!room.isGroup) {
    // Vérifier si l'utilisateur interlocuteur a supprimé son compte
    if (!otherUser?.id) {
      return { type: RoomFooterStateType.UserDeleted };
    }
    // Sinon, l'utilisateur peut envoyer des messages
    return { type: RoomFooterStateType.Normal };
  }

  // Pour les groupes, vérifier le statut du membre
  const member = room.members.find((m) => m.userId === loggedUserId);

  // Utilisateur expulsé
  if (member?.type === "OLD" && member.kickedAt !== null) {
    return { type: RoomFooterStateType.UserKicked };
  }

  // Utilisateur banni
  if (member?.type === "BANNED") {
    return { type: RoomFooterStateType.UserBanned };
  }

  // Utilisateur a quitté
  if (member?.type === "OLD" && member.kickedAt === null) {
    return { type: RoomFooterStateType.UserLeft };
  }

  // Groupe plein
  if ((room?.members?.length || 0) >= room?.maxMembers) {
    return { type: RoomFooterStateType.GroupFull };
  }

  // Utilisateur membre, admin ou owner
  if (member?.type === "MEMBER" || member?.type === "OWNER" || member?.type === "ADMIN") {
    return { type: RoomFooterStateType.Normal };
  }

  // Cas non spécifié
  return { type: RoomFooterStateType.Unspecified };
}
