import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { FCMNotificationPayload, sendPushNotification } from "@/lib/fcm";
import { ResourceApiResponse } from "cloudinary";
import { notificationsInclude } from "@/lib/types";

// Base directories for different types of uploads
const attachmentDir = path.resolve("data/uploads/attachments");

async function hasOtherFileReferences(
  publicId: string,
  candidateAttachmentIds: string[],
  candidateVoiceNoteIds: string[],
  candidateMediaIds: string[],
  candidateAvatarIds: string[],
) {
  const [attachmentCount, voiceNoteCount, avatarCount, mediaCount] =
    await Promise.all([
      prisma.messageAttachment.count({
        where: {
          publicId,
          id: { notIn: candidateAttachmentIds },
        },
      }),
      prisma.voiceNote.count({
        where: {
          publicId,
          id: { notIn: candidateVoiceNoteIds },
        },
      }),
      prisma.userAvatar.count({
        where: { publicId, id: { notIn: candidateAvatarIds } },
      }),
      prisma.media.count({
        where: {
          url: { contains: publicId },
          id: { notIn: candidateMediaIds },
        },
      }),
    ]);

  return (
    attachmentCount > 0 ||
    voiceNoteCount > 0 ||
    avatarCount > 0 ||
    mediaCount > 0
  );
}

function getCloudinaryPublicId(url: string) {
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex < 0) return null;

  const pathSegments = url.slice(uploadIndex + "/upload/".length).split("/");
  const versionIndex = pathSegments.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionIndex < 0 || versionIndex === pathSegments.length - 1) return null;

  const publicId = pathSegments.slice(versionIndex + 1).join("/").replace(/\.[^.]+$/, "");
  return publicId || null;
}

function removeLocalFileIfPresent(filePath: string) {
  try {
    fs.lstatSync(filePath);
    fs.unlinkSync(filePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization header" }),
        { status: 401 },
      );
    }

    // --- MODÉRATION ---
    // Rechercher les publications sans description avec une seule image
    const postsToModerate = await prisma.post.findMany({
      where: {
        content: "",
        attachments: {
          some: {
            type: "IMAGE",
          },
        },
      },
      include: {
        attachments: true,
      },
    });

    for (const post of postsToModerate) {
      if (post.attachments.length === 1) {
        const media = post.attachments[0];
        let isMonochrome = false;

        // Si l'image est locale
        if (media.url.includes("/uploads/attachments/")) {
          const filePath = path.join(
            attachmentDir,
            media.url.split("/uploads/attachments/")[1],
          );

          if (fs.existsSync(filePath)) {
            try {
              const stats = await sharp(filePath).stats();
              // Un écart-type faible (stdev) dans tous les canaux indique une couleur unie
              isMonochrome = stats.channels.every((c) => c.stdev < 3);
            } catch (err) {
              console.error(`Erreur analyse sharp pour ${filePath}:`, err);
            }
          }
        }
        // Si l'image est sur Cloudinary
        else if (media.url.includes("res.cloudinary.com")) {
          try{
            const publicId = media.url.split("/").slice(-1)[0].split(".")[0];
            const result: ResourceApiResponse = await cloudinary.api.resource(publicId, {
              colors: true,
            });
            isMonochrome = result.resources?.[0]?.colors?.length < 3;
          }catch(err){
            console.error(`Erreur récupération info Cloudinary pour ${media.url}:`, err);
          }
        }

        if (isMonochrome) {
          console.log(
            `[Modération] Suppression du post ${post.id} (image monochrome sans description)`,
          );

          const notification = await prisma.notification.create({
            data: {
              recipientId: post.userId,
              issuerId: post.userId, 
              type: "MODERATION",
            },
            include: notificationsInclude,
          });

          const payload: FCMNotificationPayload = {
            type: "NOTIFICATION",
            notification,
          };

          // Envoyer notification push
          await sendPushNotification(post.userId, payload);

          // Supprimer le post
          await prisma.post.update({
            where: { id: post.id },
            data: { visibility: "PRIVATE" },
          });
          
        }
      }
    }

    // Rechercher les médias inutilisés
    const unusedMedia = await prisma.media.findMany({
      where: {
        postId: null,
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000), // 1 jour
              },
            }
          : {}),
      },
      select: {
        id: true,
        url: true,
      },
    });

    const referencedAvatarUrls = new Set(
      (
        await prisma.user.findMany({
          select: { avatarUrl: true },
        })
      )
        .map((user) => user.avatarUrl)
        .filter(Boolean) as string[],
    );

    const orphanAvatars = await prisma.userAvatar.findMany({
      where: {
        url: { notIn: Array.from(referencedAvatarUrls) },
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000),
              },
            }
          : {}),
      },
      select: { id: true, url: true, publicId: true, resourceType: true },
    });

    // Rechercher les pièces jointes de messages inutilisées
    const unusedMessageAttachments = await prisma.messageAttachment.findMany({
      where: {
        messageId: null,
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000), // 1 jour
              },
            }
          : {}),
      },
      select: {
        id: true,
        publicId: true,
      },
    });

    const unusedVoiceNotes = await prisma.voiceNote.findMany({
      where: {
        messageId: null,
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000),
              },
            }
          : {}),
      },
      select: {
        id: true,
        publicId: true,
      },
    });

    const candidateAttachmentIds = unusedMessageAttachments.map(
      (attachment) => attachment.id,
    );
    const candidateVoiceNoteIds = unusedVoiceNotes.map(
      (voiceNote) => voiceNote.id,
    );
    const candidateMediaIds = unusedMedia.map((media) => media.id);
    const candidateAvatarIds = orphanAvatars.map((avatar) => avatar.id);
    const safeToDeletePublicIds = new Set<string>();
    const processedPublicIds = new Set<string>();

    const safeToDeleteMediaIds = new Set<string>();
    for (const media of unusedMedia) {
      if (media.url.includes("/uploads/attachments/")) {
        const relativePath = media.url.split("/uploads/attachments/")[1];
        const filePath = path.resolve(attachmentDir, relativePath);
        if (!filePath.startsWith(`${attachmentDir}${path.sep}`)) {
          console.error(`Invalid local media path: ${media.url}`);
          continue;
        }

        try {
          removeLocalFileIfPresent(filePath);
          safeToDeleteMediaIds.add(media.id);
        } catch (error) {
          console.error(`Error deleting local media ${filePath}:`, error);
        }
        continue;
      }

      const publicId = getCloudinaryPublicId(media.url);
      if (!publicId || processedPublicIds.has(publicId)) continue;
      processedPublicIds.add(publicId);

      if (
        await hasOtherFileReferences(
          publicId,
          candidateAttachmentIds,
          candidateVoiceNoteIds,
          candidateMediaIds,
          candidateAvatarIds,
        )
      ) {
        safeToDeletePublicIds.add(publicId);
        continue;
      }

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          invalidate: true,
        });
        if (result.result === "ok" || result.result === "not found") {
          safeToDeletePublicIds.add(publicId);
        } else {
          console.error(
            `Cloudinary did not confirm deletion of ${publicId}:`,
            result,
          );
        }
      } catch (error) {
        console.error(`Error deleting Cloudinary media ${publicId}:`, error);
      }
    }

    for (const media of unusedMedia) {
      const publicId = getCloudinaryPublicId(media.url);
      if (
        safeToDeleteMediaIds.has(media.id) ||
        (publicId && safeToDeletePublicIds.has(publicId))
      ) {
        safeToDeleteMediaIds.add(media.id);
      }
    }

    await prisma.media.deleteMany({
      where: { id: { in: Array.from(safeToDeleteMediaIds) } },
    });

    // Delete a Cloudinary file only when no retained record references it.
    for (const { publicId } of [
      ...unusedMessageAttachments,
      ...unusedVoiceNotes,
    ]) {
      if (publicId && !processedPublicIds.has(publicId)) {
        processedPublicIds.add(publicId);

        if (
          await hasOtherFileReferences(
            publicId,
            candidateAttachmentIds,
            candidateVoiceNoteIds,
            candidateMediaIds,
            candidateAvatarIds,
          )
        ) {
          safeToDeletePublicIds.add(publicId);
          continue;
        }

        try {
          const result = await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
          });
          if (result.result === "ok" || result.result === "not found") {
            safeToDeletePublicIds.add(publicId);
          } else {
            console.error(
              `Cloudinary did not confirm deletion of ${publicId}:`,
              result,
            );
          }
        } catch (error) {
          console.error(`Error deleting Cloudinary file ${publicId}:`, error);
        }
      }
    }

    // Keep records when file deletion could not be confirmed, so it can be retried.
    await prisma.messageAttachment.deleteMany({
      where: {
        id: {
          in: unusedMessageAttachments
            .filter(
              (attachment) =>
                attachment.publicId &&
                safeToDeletePublicIds.has(attachment.publicId),
            )
            .map((attachment) => attachment.id),
        },
      },
    });

    await prisma.voiceNote.deleteMany({
      where: {
        id: {
          in: unusedVoiceNotes
            .filter(
              (voiceNote) =>
                voiceNote.publicId &&
                safeToDeletePublicIds.has(voiceNote.publicId),
            )
            .map((voiceNote) => voiceNote.id),
        },
      },
    });

    // Keep orphan avatar records until file deletion is confirmed.
    const safeToDeleteAvatarIds = new Set<string>();
    for (const avatar of orphanAvatars) {
      if (avatar.url.includes("/uploads/avatars/")) {
        const avatarDir = path.resolve("data/uploads/avatars");
        const relativePath = avatar.url.split("/uploads/avatars/")[1];
        const filePath = path.resolve(avatarDir, relativePath);
        if (!filePath.startsWith(`${avatarDir}${path.sep}`)) {
          console.error(`Invalid local avatar path: ${avatar.url}`);
          continue;
        }

        try {
          removeLocalFileIfPresent(filePath);
          safeToDeleteAvatarIds.add(avatar.id);
        } catch (error) {
          console.error(`Error deleting local avatar ${filePath}:`, error);
        }
        continue;
      }

      const publicId = avatar.publicId || getCloudinaryPublicId(avatar.url);
      if (!publicId || processedPublicIds.has(publicId)) continue;
      processedPublicIds.add(publicId);

      if (
        await hasOtherFileReferences(
          publicId,
          candidateAttachmentIds,
          candidateVoiceNoteIds,
          candidateMediaIds,
          candidateAvatarIds,
        )
      ) {
        safeToDeletePublicIds.add(publicId);
        continue;
      }

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: avatar.resourceType || "image",
          invalidate: true,
        });
        if (result.result === "ok" || result.result === "not found") {
          safeToDeletePublicIds.add(publicId);
        } else {
          console.error(
            `Cloudinary did not confirm deletion of ${publicId}:`,
            result,
          );
        }
      } catch (error) {
        console.error(`Error deleting Cloudinary avatar ${publicId}:`, error);
      }
    }

    for (const avatar of orphanAvatars) {
      const publicId = avatar.publicId || getCloudinaryPublicId(avatar.url);
      if (
        safeToDeleteAvatarIds.has(avatar.id) ||
        (publicId && safeToDeletePublicIds.has(publicId))
      ) {
        safeToDeleteAvatarIds.add(avatar.id);
      }
    }

    await prisma.userAvatar.deleteMany({
      where: { id: { in: Array.from(safeToDeleteAvatarIds) } },
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
