import prisma from "./prisma";

/**
 * Supprime les anciennes sessions du même compte sur le même device
 * @param userId - ID de l'utilisateur
 * @param deviceId - ID du device
 * @param excludeSessionId - ID de la session à exclure (la nouvelle session créée)
 */
export async function deleteOldSessionsForAccountOnDevice(
  userId: string,
  deviceId: string,
  excludeSessionId: string,
): Promise<void> {
  if (!deviceId || !userId) {
    // Si pas de deviceId, on ne supprime rien (ancien comportement)
    return;
  }

  try {
    // Supprimer toutes les sessions de ce user avec ce deviceId, sauf la nouvelle
    await prisma.session.deleteMany({
      where: {
        userId: userId,
        deviceId: deviceId,
        id: {
          not: excludeSessionId,
        },
      },
    });
  } catch (error) {
    console.error(
      `Erreur lors de la suppression des anciennes sessions pour ${userId} sur device ${deviceId}:`,
      error,
    );
    // On ne lance pas l'erreur pour ne pas bloquer la création de la nouvelle session
  }
}
