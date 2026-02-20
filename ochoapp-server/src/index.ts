import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { PrismaClient, Prisma, NotificationType } from "@prisma/client"; // Garder les types
import prisma from "./prisma";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import cookieParser from "cookie-parser";
import chalk from "chalk";
import {
  getChatRoomDataInclude,
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
  SocketSendMessageEvent,
  SocketStartChatEvent,
  SocketMarkMessageReadEvent,
  SocketMarkMessageDeliveredEvent,
  SocketAddReactionEvent,
  SocketRemoveReactionEvent,
  SocketDeleteMessageEvent,
  SocketGetRoomsEvent,
  SocketCheckUserStatusEvent,
  SocketCreateNotificationEvent,
  SocketDeleteNotificationEvent,
} from "./types";
import {
  getFormattedRooms,
  getUnreadRoomsCount,
  getUnreadMessagesCountPerRoom,
  getMessageDeliveries,
  groupManagment,
  socketHandler,
  validateSession,
} from "./utils";
import {
  handleStartChat,
  handleMarkMessageRead,
  handleMarkMessageDelivered,
  handleAddReaction,
  handleRemoveReaction,
  handleDeleteMessage,
  handleSendSavedMessage,
  handleSendNormalMessage,
  markUndeliveredMessages,
} from "./socket-handlers";

dotenv.config();

const app = express();
const server = http.createServer(app);
// SUPPRIMÉ: const prisma = new PrismaClient(); -> On utilise l'import singleton

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
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    const normalizedAllowed = allowedOrigins.map((url) =>
      url.toLowerCase().replace(/\/$/, ""),
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
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

app.get("/", (req, res) => {
  res.json({ message: "Hello from the server" });
});

app.post("/api/cloudinary/proxy-upload", async (req, res) => {
  try {
    const body = req.body || {};
    const file = body.file;
    if (!file)
      return res
        .status(400)
        .json({ success: false, error: "No file provided" });

    const uploadResult = await cloudinary.uploader.upload(file, {
      resource_type: "auto",
    });

    const attachmentType =
      uploadResult.resource_type &&
      String(uploadResult.resource_type).startsWith("video")
        ? "VIDEO"
        : uploadResult.resource_type === "image" ||
            (uploadResult.secure_url &&
              /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(uploadResult.secure_url))
          ? "IMAGE"
          : "DOCUMENT";

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

    return res.json({
      success: true,
      attachmentId: messageAttachment.id,
      result: uploadResult,
    });
  } catch (err) {
    console.error("Proxy upload error", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "Upload failed",
        details: err instanceof Error ? err.message : undefined,
      });
  }
});

app.post(
  "/api/cloudinary/proxy-upload-multipart",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer)
        return res
          .status(400)
          .json({ success: false, error: "No file provided" });

      const streamUpload = (buffer: Buffer) =>
        new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result as UploadApiResponse);
            },
          );
          stream.end(buffer);
        });

      const uploadResult = await streamUpload(file.buffer);

      const attachmentType =
        uploadResult.resource_type &&
        String(uploadResult.resource_type).startsWith("video")
          ? "VIDEO"
          : uploadResult.resource_type === "image" ||
              (uploadResult.secure_url &&
                /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(
                  uploadResult.secure_url,
                ))
            ? "IMAGE"
            : "DOCUMENT";

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

      return res.json({
        success: true,
        attachmentId: messageAttachment.id,
        result: uploadResult,
      });
    } catch (err) {
      console.error("Proxy multipart upload error", err);
      return res
        .status(500)
        .json({
          success: false,
          error: "Upload failed",
          details: err instanceof Error ? err.message : undefined,
        });
    }
  },
);
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
      const normalizedAllowed = allowedOrigins.map((url) =>
        url.toLowerCase().replace(/\/$/, ""),
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

io.on("connection", async (socket: Socket) => {
  const userId = socket.data.user.id;
  const username = socket.data.user.username;
  const displayName = socket.data.user.displayName || username;
  const avatarUrl = socket.data.user.avatarUrl;

  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true },
  });

  socket.join(userId);

  groupManagment(io, socket, { userId, username, displayName, avatarUrl });

  await markUndeliveredMessages(userId, io);

  socket.on("start_chat", async (data: SocketStartChatEvent) => {
    try {
      const result = await handleStartChat(data, userId);

      if ("newRoom" in result) {
        // Nouvelle room créée
        const { newRoom, otherMemberIds } = result;
        socket.join(newRoom.id);

        otherMemberIds.forEach((memberId) => {
          io.to(memberId).emit("new_room_created", newRoom);
        });

        socket.emit("room_ready", newRoom);
      } else {
        // Room existante
        socket.emit("room_ready", result);
      }
    } catch (error) {
      console.error("Erreur start_chat:", error);
      socket.emit("error_message", "Impossible de créer la discussion.");
    }
  });

  socket.on("get_rooms", async (data: SocketGetRoomsEvent): Promise<void> => {
    const { cursor } = data;
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
        roomId,
      ),
    );

    if (roomId === "saved-" + userId) {
      socket.join(roomId);
      console.log(
        chalk.green(
          socket.data.user.username || userId,
          "a rejoins le salon:",
          roomId,
        ),
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
          roomId,
        ),
      );
    }
  });

  socket.on("leave_room", (roomId: string) => {
    socket.leave(roomId);
    console.log(
      chalk.gray(`${displayName} a quitté le salon (socket): ${roomId}`),
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

    io.to(roomId).emit("typing_update", { roomId, typingUsers });
  });

  socket.on("typing_stop", (roomId: string) => {
    const roomTyping = typingUsersByRoom.get(roomId);
    if (roomTyping) {
      roomTyping.delete(userId);
      if (roomTyping.size === 0) {
        typingUsersByRoom.delete(roomId);
      }
      const typingList = Array.from(roomTyping?.values() || []).filter(
        (u) => u.id !== userId,
      );
      io.to(roomId).emit("typing_update", { roomId, typingUsers: typingList });
    }
  });

  socket.on("mark_message_read", async (data: SocketMarkMessageReadEvent) => {
    const { messageId, roomId } = data;
    try {
      const { reads, unreadCount } = await handleMarkMessageRead(
        messageId,
        roomId,
        userId,
      );

      io.to(roomId).emit("message_read_update", {
        messageId,
        reads,
      });

      // 1. Mise à jour GLOBAL (badge app/navbar)
      io.to(userId).emit("rooms_unreads_update", {
        unreadCount, // Total des salons non lus
      });

      // 2. Mise à jour SPÉCIFIQUE AU SALON (badge room)
      const currentRoomUnreadCount = await getUnreadMessagesCountPerRoom(
        userId,
        roomId,
      );

      io.to(userId).emit("room_unread_count_update", {
        roomId,
        unreadCount: currentRoomUnreadCount,
      });
    } catch (error) {
      console.error("Erreur mark_message_read:", error);
    }
  });

  socket.on(
    "mark_message_delivered",
    async (data: SocketMarkMessageDeliveredEvent) => {
      const { messageId, roomId } = data;
      try {
        const { deliveries } = await handleMarkMessageDelivered(
          messageId,
          roomId,
          userId,
        );

        io.to(roomId).emit("message_delivered_update", {
          messageId,
          deliveries,
        });
      } catch (error) {
        console.error("Erreur mark_message_delivered:", error);
      }
    },
  );

  socket.on("add_reaction", async (data: SocketAddReactionEvent) => {
    try {
      const { reactions, affectedUserIds, senderUsername } =
        await handleAddReaction(data, userId, username);

      io.to(data.roomId).emit("message_reaction_update", {
        messageId: data.messageId,
        reactions,
      });

      // Emet la mise à jour des rooms pour les utilisateurs affectés
      for (const affectedId of affectedUserIds) {
        const user = await prisma.user.findUnique({
          where: { id: affectedId },
          select: { username: true },
        });
        if (user) {
          const updatedRooms = await getFormattedRooms(
            affectedId,
            user.username,
          );
          io.to(affectedId).emit("room_list_updated", updatedRooms);
        }
      }
    } catch (error) {
      console.error("Erreur add_reaction:", error);
      socket.emit("error", { message: "Impossible d'ajouter la réaction" });
    }
  });

  socket.on("remove_reaction", async (data: SocketRemoveReactionEvent) => {
    try {
      const { reactions, affectedUserIds, senderUsername } =
        await handleRemoveReaction(data, userId, username);

      io.to(data.roomId).emit("message_reaction_update", {
        messageId: data.messageId,
        reactions,
      });

      // Emet la mise à jour des rooms pour les utilisateurs affectés
      for (const affectedId of affectedUserIds) {
        const user = await prisma.user.findUnique({
          where: { id: affectedId },
          select: { username: true },
        });
        if (user) {
          const updatedRooms = await getFormattedRooms(
            affectedId,
            user.username,
          );
          io.to(affectedId).emit("room_list_updated", updatedRooms);
        }
      }
    } catch (error) {
      console.error("Erreur remove_reaction:", error);
      socket.emit("error", {
        message: "Impossible de supprimer la réaction",
      });
    }
  });
  socket.on("delete_message", async (data: SocketDeleteMessageEvent) => {
    try {
      const { isSavedRoom, attachmentIds, affectedUserIds } =
        await handleDeleteMessage(data, userId, username);

      io.to(data.roomId).emit("message_deleted", {
        messageId: data.messageId,
        roomId: data.roomId,
      });

      if (attachmentIds.length > 0) {
        io.to(data.roomId).emit("gallery_deleted", {
          roomId: data.roomId,
          attachmentIds,
        });

        if (isSavedRoom) {
          socket.emit("gallery_deleted", {
            roomId: data.roomId,
            attachmentIds,
          });
        }
      }

      if (isSavedRoom) {
        socket.emit("message_deleted", {
          messageId: data.messageId,
          roomId: data.roomId,
        });

        const updatedRooms = await getFormattedRooms(userId, username);
        io.to(userId).emit("room_list_updated", updatedRooms);
      } else {
        // Emet la mise à jour des rooms et des unreads pour les membres affectés
        for (const affectedId of affectedUserIds) {
          const user = await prisma.user.findUnique({
            where: { id: affectedId },
            select: { username: true },
          });
          if (user) {
            const updatedRooms = await getFormattedRooms(
              affectedId,
              user.username,
            );
            const newGlobalUnreadCount = await getUnreadRoomsCount(affectedId);
            const newRoomUnreadCount = await getUnreadMessagesCountPerRoom(
              affectedId,
              data.roomId,
            );

            io.to(affectedId).emit("room_list_updated", updatedRooms);

            // 1. Mise à jour GLOBAL (Badge Navbar/Menu)
            io.to(affectedId).emit("rooms_unreads_update", {
              unreadCount: newGlobalUnreadCount,
            });

            // 2. Mise à jour SPÉCIFIQUE (Badge Salon)
            io.to(affectedId).emit("room_unread_count_update", {
              roomId: data.roomId,
              unreadCount: newRoomUnreadCount,
            });
          }
        }
      }
    } catch (error) {
      console.error("Erreur delete_message:", error);
      socket.emit("error", { message: "Impossible de supprimer le message" });
    }
  });

  socket.on("send_message", async (data: SocketSendMessageEvent) => {
    const { tempId, roomId } = data;

    console.log(chalk.blue("Envoi du message:", data.content));
    console.log(chalk.blue("Attachments:", data.attachmentIds));

    try {
      const isSavedMessage = roomId === `saved-${userId}`;

      if (isSavedMessage) {
        // --- BLOC MESSAGES SAUVEGARDÉS ---
        const { newMessage, galleryMedias } = await handleSendSavedMessage(
          data,
          userId,
        );

        socket.join(roomId);

        io.to(roomId).emit("receive_message", { newMessage, roomId, tempId });
        socket.emit("receive_message", { newMessage, roomId, tempId });

        // Émettre la mise à jour galerie
        if (galleryMedias && galleryMedias.length > 0) {
          io.to(roomId).emit("gallery_updated", {
            roomId,
            medias: galleryMedias,
            tempId,
          });

          socket.emit("gallery_updated", {
            roomId,
            medias: galleryMedias,
            tempId,
          });
        }

        const updatedRooms = await getFormattedRooms(userId, username);
        io.to(userId).emit("room_list_updated", updatedRooms);
      } else {
        // --- BLOC MESSAGES NORMAUX ---
        const {
          newMessage,
          newRoom,
          galleryMedias,
          affectedUserIds,
          deliveredUserIds,
        } = await handleSendNormalMessage(data, userId, username, io);

        socket.join(roomId);

        io.to(roomId).emit("receive_message", {
          newMessage,
          roomId,
          newRoom,
          tempId,
        });

        // Envoyer la mise à jour galerie
        if (galleryMedias && galleryMedias.length > 0) {
          io.to(roomId).emit("gallery_updated", {
            roomId,
            medias: galleryMedias,
            tempId,
          });

          socket.emit("gallery_updated", {
            roomId,
            medias: galleryMedias,
            tempId,
          });
        }

        // Emit delivery update if any users are online and received the message
        if (deliveredUserIds && deliveredUserIds.length > 0) {
          const updatedDeliveries = await getMessageDeliveries(newMessage.id);
          io.to(roomId).emit("message_delivered_update", {
            messageId: newMessage.id,
            deliveries: updatedDeliveries,
          });
        }

        // Émettre la mise à jour des rooms pour les membres affectés
        for (const affectedId of affectedUserIds) {
          const user = await prisma.user.findUnique({
            where: { id: affectedId },
            select: { username: true },
          });
          if (user) {
            const updatedRooms = await getFormattedRooms(
              affectedId,
              user.username,
            );
            io.to(affectedId).emit("room_list_updated", updatedRooms);

            if (affectedId !== userId) {
              const globalUnreadCount = await getUnreadRoomsCount(affectedId);
              const roomUnreadCount = await getUnreadMessagesCountPerRoom(
                affectedId,
                roomId,
              );

              // 1. Mise à jour GLOBAL (Badge Navbar/Menu : nombre de salons avec non-lus)
              io.to(affectedId).emit("rooms_unreads_update", {
                unreadCount: globalUnreadCount,
              });

              // 2. Mise à jour SPÉCIFIQUE (Badge Salon : nombre de messages non-lus dans CE salon)
              io.to(affectedId).emit("room_unread_count_update", {
                roomId: roomId,
                unreadCount: roomUnreadCount,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Erreur send_message:", error);
      socket.emit("error", { message: "Erreur lors de l'envoi" });
    }
  });

  socket.on(
    "create_notification",
    async (data: {
      type: NotificationType;
      recipientId?: string;
      postId?: string;
      commentId?: string;
    }) => {
      try {
        const { type, recipientId, postId, commentId } = data;
        if (!recipientId || !type) return;
        if (userId === recipientId) return;

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

        io.to(recipientId).emit("notification_received", notification);

        const unreadCount = await prisma.notification.count({
          where: { recipientId, read: false },
        });
        io.to(recipientId).emit("notifications_unread_update", { unreadCount });
      } catch (e) {
        console.error("Erreur create_notification socket:", e);
      }
    },
  );

  socket.on(
    "delete_notification",
    async (data: {
      type: NotificationType;
      recipientId?: string;
      postId?: string;
      commentId?: string;
    }) => {
      try {
        const { type, recipientId, postId, commentId } = data;
        if (!recipientId || !type) return;

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
          io.to(recipientId).emit("notification_deleted", {
            type,
            postId,
            commentId,
          });

          const unreadCount = await prisma.notification.count({
            where: { recipientId, read: false },
          });
          io.to(recipientId).emit("notifications_unread_update", {
            unreadCount,
          });
        }
      } catch (e) {
        console.error("Erreur delete_notification socket:", e);
      }
    },
  );

  socket.on("check_user_status", async (data: SocketCheckUserStatusEvent) => {
    const { userId } = data;
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
      io.to(room).emit("typing_stop", { roomId: room });
    });

    console.log(chalk.yellow(`${displayName} s'est déconnecté.`));
  });
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(chalk.blueBright(`🚀 Serveur de chat prêt sur le port ${PORT}`));
});
