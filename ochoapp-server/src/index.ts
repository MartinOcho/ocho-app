import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { MessageType, PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import cookieParser from "cookie-parser";
import chalk from "chalk";
import {
  getChatRoomDataInclude,
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
} from "./types";
import {
  addAdminSchema,
  addMemberSchema,
  getFormattedRooms,
  getMessageReactions,
  getMessageReads,
  getUnreadRoomsCount, // <--- Import de la nouvelle fonction
  groupManagment,
  memberActionSchema,
  socketHandler,
  validateSession,
} from "./utils";

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Normaliser et accepter les variantes d'URL (avec/sans slash, http/https)
const allowedOrigins = [
  CLIENT_URL,
  CLIENT_URL.replace(/\/$/, ""), // Sans slash
  CLIENT_URL.endsWith("/") ? CLIENT_URL : CLIENT_URL + "/", // Avec slash
];

const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Permettre les requêtes sans origin (comme mobile apps ou requests simple)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normaliser origin pour comparaison
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    const normalizedAllowed = allowedOrigins.map(url => 
      url.toLowerCase().replace(/\/$/, "")
    );
    
    if (normalizedAllowed.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS rejeté pour origin: ${origin}`);
      callback(new Error("CORS policy violation"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
// Autoriser de gros payloads pour uploads (200MB)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(cookieParser());

// Cloudinary config (utilisé pour proxy upload depuis le client si nécessaire)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// multer en mémoire pour streaming multipart
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.get("/", (req, res) => {
  res.json({ message: "Hello from the server" });
});

// Endpoint proxy pour upload Cloudinary (accepte dataURL en JSON)
app.post("/api/cloudinary/proxy-upload", async (req, res) => {
  try {
    const body = req.body || {};
    const file = body.file;
    if (!file) return res.status(400).json({ success: false, error: "No file provided" });

    // upload vers Cloudinary avec timeout/ retry minimal
    const uploadResult = await cloudinary.uploader.upload(file, { resource_type: 'auto' });

    // Créer l'entrée en base
    const attachmentType = uploadResult.resource_type && String(uploadResult.resource_type).startsWith("video")
      ? "VIDEO"
      : (uploadResult.resource_type === "image" || (uploadResult.secure_url && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(uploadResult.secure_url))
        ? "IMAGE"
        : "DOCUMENT");

    const messageAttachment = await prisma.messageAttachment.create({
      data: {
        type: attachmentType,
        url: uploadResult.secure_url || uploadResult.url || "",
        publicId: uploadResult.public_id || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        format: uploadResult.format || null,
        resourceType: uploadResult.resource_type || null,
      },
    });

    return res.json({ success: true, attachmentId: messageAttachment.id, result: uploadResult });
  } catch (err) {
    console.error('Proxy upload error', err);
    return res.status(500).json({ success: false, error: 'Upload failed', details: err instanceof Error ? err.message : undefined });
  }
});

// Endpoint multipart (FormData) pour upload direct via multer -> Cloudinary (stream)
app.post("/api/cloudinary/proxy-upload-multipart", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file || !file.buffer) return res.status(400).json({ success: false, error: "No file provided" });

    // Utiliser upload_stream pour éviter d'écrire sur le disque
    const streamUpload = (buffer: Buffer) =>
      new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        stream.end(buffer);
      });

    const uploadResult = await streamUpload(file.buffer);

    const attachmentType = uploadResult.resource_type && String(uploadResult.resource_type).startsWith("video")
      ? "VIDEO"
      : (uploadResult.resource_type === "image" || (uploadResult.secure_url && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(uploadResult.secure_url))
        ? "IMAGE"
        : "DOCUMENT");

    const messageAttachment = await prisma.messageAttachment.create({
      data: {
        type: attachmentType,
        url: uploadResult.secure_url || uploadResult.url || "",
        publicId: uploadResult.public_id || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        format: uploadResult.format || null,
        resourceType: uploadResult.resource_type || null,
      },
    });

    return res.json({ success: true, attachmentId: messageAttachment.id, result: uploadResult });
  } catch (err) {
    console.error('Proxy multipart upload error', err);
    return res.status(500).json({ success: false, error: 'Upload failed', details: err instanceof Error ? err.message : undefined });
  }
});
app.post("/api/auth/session", validateSession);

interface TypingUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}
const typingUsersByRoom = new Map<string, Map<string, TypingUser>>();

const io = new Server(server, {
  cors: {
    origin: function (origin: string | undefined, callback: Function) {
      if (!origin) {
        return callback(null, true);
      }
      
      const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
      const normalizedAllowed = allowedOrigins.map(url => 
        url.toLowerCase().replace(/\/$/, "")
      );
      
      if (normalizedAllowed.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(socketHandler);

io.on("connection", async (socket) => {
  const userId = socket.data.user.id;
  const username = socket.data.user.username;
  const displayName = socket.data.user.displayName || username;
  const avatarUrl = socket.data.user.avatarUrl;

  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true },
  });

  socket.join(userId);

  // -- GESTION DES GROUPES -- //
  groupManagment(io, socket, { userId, username, displayName, avatarUrl });

  socket.on(
    "start_chat",
    async ({ targetUserId, isGroup, name, membersIds }) => {
      try {
        let rawMembers = isGroup
          ? [...(membersIds || []), userId]
          : [userId, targetUserId];

        // Supprime les doublons et les valeurs falsy (null, undefined, chaine vide)
        const uniqueMemberIds = [...new Set(rawMembers)].filter((id) => id);

        if (isGroup && uniqueMemberIds.length < 2) {
          socket.emit(
            "error_message",
            "Un groupe doit avoir au moins 2 membres valides."
          );
          return;
        }

        // Vérification de conversation existante (seulement pour le 1-on-1)
        if (!isGroup) {
          const existingRoom = await prisma.room.findFirst({
            where: {
              isGroup: false,
              AND: [
                { members: { some: { userId: uniqueMemberIds[0] } } },
                { members: { some: { userId: uniqueMemberIds[1] } } },
              ],
            },
            include: getChatRoomDataInclude(),
          });

          if (existingRoom) {
            socket.emit("room_ready", existingRoom);
            return;
          }
        }

        const newRoom = await prisma.$transaction(async (tx) => {
          // 2. Création de la room avec rôles explicites
          const room = await tx.room.create({
            data: {
              name: isGroup ? name : null,
              isGroup: isGroup,
              members: {
                create: uniqueMemberIds.map((id) => ({
                  userId: id,
                  // Si c'est le créateur du groupe, on le met OWNER, sinon MEMBER
                  type: isGroup && id === userId ? "OWNER" : "MEMBER",
                })),
              },
            },
            include: getChatRoomDataInclude(),
          });

          // 3. Message système de création
          const message = await tx.message.create({
            data: {
              content: "created",
              roomId: room.id,
              senderId: userId, // Important: le créateur est l'expéditeur du message système
              type: "CREATE",
            },
            include: getMessageDataInclude(userId), // On inclut les infos sender pour l'affichage
          });

          // 4. Mise à jour de LastMessage pour tous les membres
          for (const memberId of uniqueMemberIds) {
            await tx.lastMessage.upsert({
              where: {
                userId_roomId: { userId: memberId, roomId: room.id },
              },
              update: { messageId: message.id, createdAt: message.createdAt },
              create: {
                userId: memberId,
                roomId: room.id,
                messageId: message.id,
              },
            });
          }

          // Retourne la room complète avec le premier message
          return { ...room, messages: [message] };
        });

        // 5. Gestion des Sockets et Diffusion
        socket.join(newRoom.id);

        // On notifie tous les membres (sauf soi-même car on utilise room_ready)
        uniqueMemberIds.forEach((memberId) => {
          if (memberId !== userId) {
            // Mise à jour en temps réel pour les autres membres
            io.to(memberId).emit("new_room_created", newRoom);

            // Notification optionnelle "unread"
            // Note: CREATE ne compte généralement pas comme unread, mais si vous le souhaitez :
            // const unread = await getUnreadRoomsCount(memberId);
            // io.to(memberId).emit("rooms_unreads_update", { unreadCount: unread });
          }
        });

        // Réponse au créateur
        socket.emit("room_ready", newRoom);
      } catch (error) {
        console.error("Erreur start_chat:", error);
        socket.emit("error_message", "Impossible de créer la discussion.");
      }
    }
  );

  socket.on("get_rooms", async ({ cursor }: { cursor?: string | null }) => {
    try {
      const response = await getFormattedRooms(userId, username, cursor);
      socket.emit("rooms_list_data", response);
    } catch (error) {
      socket.emit("error_message", "Impossible de récupérer les discussions.");
    }
  });

  socket.on("join_room", async (roomId: string) => {
    const userId = socket.data.user.id;
    console.log(
      chalk.yellow(
        socket.data.user.username || userId,
        "Tente de rejoindre le salon:",
        roomId
      )
    );

    if (roomId === "saved-" + userId) {
      socket.join(roomId);
      console.log(
        chalk.green(
          socket.data.user.username || userId,
          "a rejoins le salon:",
          roomId
        )
      );
      return;
    }

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (membership && membership.type !== "BANNED" && !membership.leftAt) {
      socket.join(roomId);
      console.log(
        chalk.green(
          socket.data.user.username || userId,
          "a rejoins le salon:",
          roomId
        )
      );
    }
  });

  socket.on("leave_room", (roomId: string) => {
    socket.leave(roomId);
    console.log(
      chalk.gray(`${displayName} a quitté le salon (socket): ${roomId}`)
    );
  });

  socket.on("typing_start", async (roomId: string) => {
    if (!roomId.startsWith("saved-")) {
      const membership = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
        select: { leftAt: true, type: true },
      });
      if (!membership || membership.leftAt || membership.type === "BANNED")
        return;
    }

    if (!typingUsersByRoom.has(roomId)) {
      typingUsersByRoom.set(roomId, new Map());
    }

    const roomTyping = typingUsersByRoom.get(roomId)!;
    roomTyping.set(userId, { id: userId, displayName, avatarUrl });

    const typingUsers = Array.from(roomTyping.values());

    socket.to(roomId).emit("typing_update", { roomId, typingUsers });
  });

  socket.on("typing_stop", (roomId: string) => {
    const roomTyping = typingUsersByRoom.get(roomId);
    if (roomTyping) {
      roomTyping.delete(userId);
      if (roomTyping.size === 0) {
        typingUsersByRoom.delete(roomId);
      }
      const typingList = Array.from(roomTyping?.values() || []).filter(
        (u) => u.id !== userId
      );
      socket
        .to(roomId)
        .emit("typing_update", { roomId, typingUsers: typingList });
    }
  });

  socket.on(
    "mark_message_read",
    async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      try {
        const userId = socket.data.user.id;

        if (!roomId.startsWith("saved-")) {
          const membership = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } },
          });

          if (
            !membership ||
            membership.type === "BANNED" ||
            membership.leftAt
          ) {
            return;
          }
        }

        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!message) return;

        await prisma.read.upsert({
          where: {
            userId_messageId: {
              userId: userId,
              messageId,
            },
          },
          create: {
            userId: userId,
            messageId,
          },
          update: {},
        });

        const updatedReads = await getMessageReads(messageId);

        io.to(roomId).emit("message_read_update", {
          messageId,
          reads: updatedReads,
        });

        // --- MISE À JOUR DU COMPTEUR POUR L'UTILISATEUR ---
        // On recalcule le nombre réel de SALONS non lus pour cet user
        const newUnreadCount = await getUnreadRoomsCount(userId);
        io.to(userId).emit("rooms_unreads_update", { 
          unreadCount: newUnreadCount 
        });
        // --------------------------------------------------
        
      } catch (error) {
        console.error("Erreur mark_message_read:", error);
      }
    }
  );

  socket.on(
    "add_reaction",
    async ({
      messageId,
      roomId,
      content,
    }: {
      messageId: string;
      roomId: string;
      content: string;
    }) => {
      try {
        const userId = socket.data.user.id;
        const username = socket.data.user.username;

        if (!roomId.startsWith("saved-")) {
          const membership = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } },
          });
          if (
            !membership ||
            membership.type === "BANNED" ||
            membership.leftAt
          ) {
            return socket.emit("error", { message: "Non autorisé" });
          }
        }

        const originalMessage = await prisma.message.findUnique({
          where: { id: messageId },
          select: {
            senderId: true,
            roomId: true,
            sender: { select: { id: true, username: true } },
          },
        });

        if (!originalMessage) return;

        const reaction = await prisma.reaction.upsert({
          where: {
            userId_messageId: {
              userId,
              messageId,
            },
          },
          create: {
            userId,
            messageId,
            content,
          },
          update: {
            content,
            createdAt: new Date(),
          },
          select: { id: true },
        });

        if (userId !== originalMessage.senderId) {
          await prisma.message.deleteMany({
            where: {
              senderId: userId,
              recipientId: originalMessage.senderId,
              roomId: originalMessage.roomId,
              type: "REACTION",
              reactionId: reaction.id,
            },
          });

          const reactionMessage = await prisma.message.create({
            data: {
              senderId: userId,
              recipientId: originalMessage.senderId,
              type: "REACTION",
              content: content,
              roomId,
              reactionId: reaction.id,
            },
          });

          if (reactionMessage.id && roomId) {
            await prisma.lastMessage.deleteMany({
              where: {
                roomId,
                userId: { in: [userId, originalMessage.senderId] },
              },
            });

            await prisma.lastMessage.createMany({
              data: [
                {
                  userId,
                  roomId,
                  messageId: reactionMessage.id,
                },
                {
                  userId: originalMessage.senderId,
                  roomId,
                  messageId: reactionMessage.id,
                },
              ],
            });

            if (originalMessage.sender?.username && originalMessage.senderId) {
              const [roomsForSender, roomsForRecipient] = await Promise.all([
                getFormattedRooms(userId, username),
                getFormattedRooms(
                  originalMessage.senderId,
                  originalMessage.sender.username
                ),
              ]);

              io.to(userId).emit("room_list_updated", roomsForSender);

              io.to(originalMessage.senderId).emit(
                "room_list_updated",
                roomsForRecipient
              );
            }
          }
        }

        const reactionsData = await getMessageReactions(messageId, userId);

        io.to(roomId).emit("message_reaction_update", {
          messageId,
          reactions: reactionsData,
        });
      } catch (error) {
        console.error("Erreur add_reaction:", error);
        socket.emit("error", { message: "Impossible d'ajouter la réaction" });
      }
    }
  );

  socket.on(
    "remove_reaction",
    async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      try {
        const userId = socket.data.user.id;
        const username = socket.data.user.username;

        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: {
            senderId: true,
            roomId: true,
            sender: { select: { id: true, username: true } },
            reactions: {
              where: { userId },
              select: { id: true },
            },
          },
        });

        if (!message || !message.reactions[0]) return;

        const reactionId = message.reactions[0].id;
        const originalSenderId = message.senderId;

        await prisma.$transaction([
          prisma.reaction.delete({
            where: { id: reactionId },
          }),
          prisma.message.deleteMany({
            where: {
              senderId: userId,
              recipientId: originalSenderId,
              roomId: message.roomId,
              reactionId: reactionId,
              type: "REACTION",
            },
          }),
        ]);

        if (originalSenderId && message.roomId) {
          const refreshLastMessage = async (targetId: string) => {
            const lastValidMessage = await prisma.message.findFirst({
              where: { roomId: message.roomId },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            });

            if (lastValidMessage) {
              await prisma.lastMessage.upsert({
                where: {
                  userId_roomId: {
                    userId: targetId,
                    roomId,
                  },
                },
                create: {
                  userId: targetId,
                  roomId,
                  messageId: lastValidMessage.id,
                },
                update: { messageId: lastValidMessage.id },
              });
            } else {
              await prisma.lastMessage.deleteMany({
                where: { userId: targetId, roomId },
              });
            }
          };

          await Promise.all([
            refreshLastMessage(userId),
            refreshLastMessage(originalSenderId),
          ]);

          if (message.sender?.username) {
            const [roomsForRemover, roomsForAuthor] = await Promise.all([
              getFormattedRooms(userId, username),
              getFormattedRooms(originalSenderId, message.sender.username),
            ]);

            io.to(userId).emit("room_list_updated", roomsForRemover);
            io.to(originalSenderId).emit("room_list_updated", roomsForAuthor);
          }
        }

        const reactionsData = await getMessageReactions(messageId, userId);
        io.to(roomId).emit("message_reaction_update", {
          messageId,
          reactions: reactionsData,
        });
      } catch (error) {
        console.error("Erreur remove_reaction:", error);
        socket.emit("error", {
          message: "Impossible de supprimer la réaction",
        });
      }
    }
  );
  socket.on(
    "delete_message",
    async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      console.log(
        chalk.red(`Tentative de suppression: msg ${messageId} par ${userId}`)
      );

      try {
        const messageToDelete = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!messageToDelete) {
          return socket.emit("error", { message: "Message introuvable" });
        }

        if (messageToDelete.senderId !== userId) {
          return socket.emit("error", {
            message: "Vous n'avez pas l'autorisation",
          });
        }

        if (roomId === "saved-" + userId) {
          await prisma.message.delete({
            where: { id: messageId },
          });
          io.to(roomId).emit("message_deleted", { messageId, roomId });
          const updatedRooms = await getFormattedRooms(userId, username);
          io.to(userId).emit("room_list_updated", updatedRooms);

          return;
        }

        await prisma.$transaction(async (tx) => {
          const nextLatestMessage = await tx.message.findFirst({
            where: {
              roomId: roomId,
              id: { not: messageId },
            },
            orderBy: { createdAt: "desc" },
          });

          if (nextLatestMessage) {
            await tx.lastMessage.updateMany({
              where: {
                roomId: roomId,
                messageId: messageId,
              },
              data: {
                messageId: nextLatestMessage.id,
                createdAt: nextLatestMessage.createdAt,
              },
            });
          } else {
            await tx.lastMessage.deleteMany({
              where: { roomId: roomId, messageId: messageId },
            });
          }

          await tx.message.delete({
            where: { id: messageId },
          });
        });

        io.to(roomId).emit("message_deleted", { messageId, roomId });

        const activeMembers = await prisma.roomMember.findMany({
          where: { roomId, leftAt: null, type: { not: "BANNED" } },
          include: { user: true },
        });

        await Promise.all(
          activeMembers.map(async (member) => {
            if (member.userId && member.user) {
              try {
                const updatedRooms = await getFormattedRooms(
                  member.userId,
                  member.user.username
                );
                io.to(member.userId).emit("room_list_updated", updatedRooms);
                
                // Recalcul des non lus (le message supprimé peut changer le statut lu du salon)
                const newUnreadCount = await getUnreadRoomsCount(member.userId);
                io.to(member.userId).emit("rooms_unreads_update", { 
                    unreadCount: newUnreadCount 
                });

              } catch (e) {
                console.error(
                  `Erreur refresh sidebar pour ${member.userId}:`,
                  e
                );
              }
            }
          })
        );
      } catch (error) {
        console.error("Erreur delete_message:", error);
        socket.emit("error", { message: "Impossible de supprimer le message" });
      }
    }
  );

  socket.on(
    "send_message",
    async (data: {
      content: string;
      roomId: string;
      type: MessageType;
      recipientId: string | undefined;
      tempId?: string;
      attachmentIds?: string[];
    }) => {
      const userId = socket.data.user.id;
      const username = socket.data.user.username;
      const { content, roomId, type, recipientId, tempId, attachmentIds = [] } = data;

      console.log(chalk.blue("Envoi du message:", content));
      console.log(chalk.blue("Attachments:", attachmentIds));

      try {
        const isSavedMessage = roomId === `saved-${userId}`;
        let newMessage: MessageData | null = null;

        if (isSavedMessage) {
          const savedMsg = await prisma.message.create({
            data: {
              content,
              senderId: userId,
              type: "SAVED",
            },
            include: getMessageDataInclude(userId),
          });

          let emissionType = "CONTENT";
          if (content === "create-" + userId) {
            emissionType = "SAVED";
          }
          newMessage = { ...savedMsg, type: emissionType } as MessageData;

          socket.join(roomId);
          // AJOUT : Renvoyer tempId au client
          io.to(roomId).emit("receive_message", { newMessage, roomId, tempId });

          const updatedRooms = await getFormattedRooms(userId, username);
          io.to(userId).emit("room_list_updated", updatedRooms);
        } else {
          const membership = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } },
          });

          if (
            !membership ||
            membership.type === "BANNED" ||
            membership.leftAt
          ) {
            return socket.emit("error", { message: "Action non autorisée" });
          }

          // Support attachments: use attachmentIds from client
          let createdMessage: any = null;
          let roomData: any = null;

          await prisma.$transaction(async (tx) => {
            // Create message
              createdMessage = await tx.message.create({
                data: {
                  content,
                  roomId,
                  senderId: userId,
                  type,
                  recipientId,
                },
                // NB: on crée le message ici sans attachments encore liés
              });

            // If attachmentIds provided, verify they exist and associate them with the message
            if (attachmentIds && attachmentIds.length > 0) {
              // Verify all attachments exist
              const existingAttachments = await tx.messageAttachment.findMany({
                where: {
                  id: { in: attachmentIds },
                },
              });

              if (existingAttachments.length !== attachmentIds.length) {
                console.warn("Some attachment IDs do not exist:", {
                  requested: attachmentIds,
                  found: existingAttachments.map(a => a.id),
                });
              }

              // Update attachments to associate with this message
              await tx.messageAttachment.updateMany({
                where: {
                  id: { in: attachmentIds },
                },
                data: {
                  messageId: createdMessage.id,
                },
              });
            }

            roomData = await tx.room.findUnique({
              where: { id: roomId },
              include: getChatRoomDataInclude(),
            });
          });

          // Après la transaction, recharger le message avec les relations (attachments, sender, etc.)
          // afin que l'objet émis contienne bien les attachments qui viennent d'être liés.
          newMessage = await prisma.message.findUnique({
            where: { id: createdMessage.id },
            include: getMessageDataInclude(userId),
          });

          const activeMembers = await prisma.roomMember.findMany({
            where: { roomId, leftAt: null, type: { not: "BANNED" } },
            include: { user: true },
          });

          if (newMessage) {
            for (const member of activeMembers) {
              if (member.userId) {
                await prisma.lastMessage.upsert({
                  where: { userId_roomId: { userId: member.userId, roomId } },
                  create: {
                    userId: member.userId,
                    roomId,
                    messageId: newMessage.id,
                  },
                  update: { messageId: newMessage.id, createdAt: new Date() },
                });
              }
            }
            socket.join(roomId);

            // AJOUT : Émettre une mise à jour de la galerie si le message a des attachements
            if (
              attachmentIds &&
              attachmentIds.length > 0 &&
              newMessage &&
              newMessage.attachments &&
              newMessage.sender
            ) {
              const galleryMedias = newMessage.attachments.map((att) => ({
                id: att.id,
                type: att.type,
                url: att.url,
                publicId: att.publicId,
                width: att.width,
                height: att.height,
                format: att.format,
                resourceType: att.resourceType,
                messageId: newMessage!.id,
                senderUsername: newMessage!.sender!.username,
                senderAvatar: newMessage!.sender!.avatarUrl,
                sentAt: newMessage!.createdAt,
              }));

              io.to(roomId).emit("gallery_updated", {
                roomId,
                medias: galleryMedias,
              });
            }

            // AJOUT : Renvoyer tempId au client
            io.to(roomId).emit("receive_message", {
              newMessage,
              roomId,
              newRoom: roomData,
              tempId, // Important pour le mapping côté client
            });

            await Promise.all(
              activeMembers.map(async (member) => {
                if (member.userId && member.user) {
                  try {
                    const updatedRooms = await getFormattedRooms(
                      member.userId,
                      member.user.username
                    );
                    io.to(member.userId).emit("room_list_updated", updatedRooms);

                    // --- MODIFICATION ICI : Calcul exact ---
                    // On ne fait plus un simple increment. On recalcule le VRAI nombre.
                    if (member.userId !== userId) {
                      const unreadCount = await getUnreadRoomsCount(member.userId);
                      io.to(member.userId).emit("rooms_unreads_update", {
                          unreadCount // Envoi du nombre exact (ex: 3 salons non lus)
                      });
                    }
                    // ----------------------------------------

                  } catch (e) {
                    console.error("Erreur refresh member:", member.userId);
                  }
                }
              })
            );
          }
        }
      } catch (error) {
        console.error("Erreur send_message:", error);
        // On pourrait ajouter le tempId ici aussi si on voulait gérer l'erreur spécifiquement
        socket.emit("error", { message: "Erreur lors de l'envoi" });
      }
    }
  );

  // Créer une notification via socket : le socket reçoit les données, crée la notification
  // en base, puis émet l'objet complet au destinataire + met à jour le compteur
  socket.on(
    "create_notification",
    async (data: {
      type: any;
      recipientId?: string;
      postId?: string;
      commentId?: string;
    }) => {
      try {
        const { type, recipientId, postId, commentId } = data;
        if (!recipientId || !type) return;
        if (userId === recipientId) return; // Don't notify yourself

        const notification = await prisma.notification.create({
          data: {
            type,
            recipientId,
            issuerId: userId,
            postId,
            commentId,
          },
          include: {
            issuer: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            post: {
              select: {
                content: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
              },
            },
          },
        });

        // Émettre l'objet notification complet à la socket du destinataire
        io.to(recipientId).emit("notification_received", notification);

        // Recalculer et émettre le compteur non-lu
        const unreadCount = await prisma.notification.count({
          where: { recipientId, read: false },
        });
        io.to(recipientId).emit("notifications_unread_update", { unreadCount });
      } catch (e) {
        console.error("Erreur create_notification socket:", e);
      }
    }
  );

  // Supprimer une notification via socket
  socket.on(
    "delete_notification",
    async (data: {
      type: any;
      recipientId?: string;
      postId?: string;
      commentId?: string;
    }) => {
      try {
        const { type, recipientId, postId, commentId } = data;
        if (!recipientId || !type) return;

        // Supprimer la notification correspondante
        const deleteResult = await prisma.notification.deleteMany({
          where: {
            type,
            recipientId,
            issuerId: userId,
            postId: postId || undefined,
            commentId: commentId || undefined,
          },
        });

        if (deleteResult.count > 0) {
          // Émettre l'événement de suppression
          io.to(recipientId).emit("notification_deleted", { type, postId, commentId });

          // Recalculer et émettre le compteur non-lu
          const unreadCount = await prisma.notification.count({
            where: { recipientId, read: false },
          });
          io.to(recipientId).emit("notifications_unread_update", { unreadCount });
        }
      } catch (e) {
        console.error("Erreur delete_notification socket:", e);
      }
    }
  );

  socket.on("check_user_status", async ({ userId }: { userId: string }) => {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isOnline: true, lastSeen: true, id: true },
    });

    if (targetUser) {
      socket.emit("user_status_change", {
        userId: targetUser.id,
        isOnline: targetUser.isOnline,
        lastSeen: targetUser.lastSeen,
      });
    }
  });
  socket.broadcast.emit("user_status_change", {
    userId: userId,
    isOnline: true,
  });

  console.log(chalk.green(`${displayName} est en ligne.`));

  socket.on("disconnect", async () => {
    const lastSeen = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeen },
    });

    socket.broadcast.emit("user_status_change", {
      userId: userId,
      isOnline: false,
      lastSeen: lastSeen,
    });
    
    typingUsersByRoom.forEach((typingUsers, room) => {
      typingUsers.delete(userId);
      io.to(room).emit("stop_typing", { roomId: room });
    });

    console.log(chalk.yellow(`${displayName} s'est déconnecté.`));
  });
});

// @ts-expect-error - L'argument de type 'string' n'est pas attribuable au paramètre de type 'number'.
server.listen(PORT, "0.0.0.0", () => {
  console.log(chalk.blueBright(`🚀 Serveur de chat prêt sur le port ${PORT}`));
});
