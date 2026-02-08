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
  
  // 1. État de chargement et garde-fous
  // Nous vérifions en premier si les données essentielles sont présentes pour éviter les erreurs de lecture.
  if (isLoading || !room || !loggedUserId) {
    return { type: RoomFooterStateType.Loading };
  }

  // 2. Cas spécial : Messages sauvegardés (Notes personnelles)
  if (isSaved) {
    return { type: RoomFooterStateType.Normal };
  }

  // 3. Gestion des conversations privées (DM)
  if (!room.isGroup) {
    if (!otherUser?.id) {
      return { type: RoomFooterStateType.UserDeleted };
    }
    return { type: RoomFooterStateType.Normal };
  }

  // 4. Gestion des Groupes
  const member = room.members.find((m) => m.userId === loggedUserId);

  // Si l'utilisateur n'est pas trouvé dans la liste des membres et n'est pas "OLD"
  if (!member) {
    return { type: RoomFooterStateType.Unspecified };
  }

  // Priorité 1 : Le bannissement (statut permanent et restrictif)
  if (member.type === "BANNED") {
    return { type: RoomFooterStateType.UserBanned };
  }

  // Priorité 2 : Analyse des anciens membres (OLD)
  if (member.type === "OLD") {
    /**
     * CORRECTION : On compare les dates si les deux existent, 
     * ou on vérifie la présence stricte de l'un ou l'autre.
     * Si 'kickedAt' existe mais que 'leftAt' est plus récent, c'est un départ volontaire.
     */
    const kickedDate = member.kickedAt ? new Date(member.kickedAt).getTime() : 0;
    const leftDate = member.leftAt ? new Date(member.leftAt).getTime() : 0;

    if (kickedDate > 0 && kickedDate >= leftDate) {
      return { type: RoomFooterStateType.UserKicked };
    } 
    
    if (leftDate > 0) {
      return { type: RoomFooterStateType.UserLeft };
    }
  }

  // 5. Vérification du remplissage du groupe pour les nouveaux membres potentiels
  // On ne vérifie cela que si l'utilisateur n'est pas déjà un membre actif.
  const isCurrentlyActive = ["MEMBER", "OWNER", "ADMIN"].includes(member.type);
  if (!isCurrentlyActive && (room.members.length >= room.maxMembers)) {
    return { type: RoomFooterStateType.GroupFull };
  }

  // 6. Utilisateur actif
  if (isCurrentlyActive) {
    return { type: RoomFooterStateType.Normal };
  }

  return { type: RoomFooterStateType.Unspecified };
}