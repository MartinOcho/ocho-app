import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { NotificationType, MediaType } from "@prisma/client";
import prisma from "./prisma";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import cookieParser from "cookie-parser";
import chalk from "chalk";
import {
  SocketSendMessageEvent,
  SocketStartChatEvent,
  SocketMarkMessageReadEvent,
  SocketMarkMessageDeliveredEvent,
  SocketAddReactionEvent,
  SocketRemoveReactionEvent,
  SocketDeleteMessageEvent,
  SocketGetRoomsEvent,
  SocketSearchRoomsEvent,
  SocketGetRoomDetailsEvent,
  SocketGetLastMessageEvent,
  SocketCheckUserStatusEvent,
  notificationsInclude,
} from "./types";
import {
  getFormattedRooms,
  searchRooms,
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
  handleGetRoomDetails,
  handleGetLastMessage,
} from "./socket-handlers";
import { FileLike, getFileExtension } from "./files";

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
  const userAgent = req.get('User-Agent') || '';
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isMobile = isAndroid || isIOS;

  // Page de bienvenue pour tous les appareils
  const title = isMobile ? "Ouvrez OchoApp mobile" : "Bienvenue sur OchoApp";
  const description = isMobile ? "Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives." : "Accédez à OchoApp pour une expérience optimale.";
  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue sur OchoApp</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f0f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .toast { max-width: 400px; width: 90%; background: white; border-radius: 28px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
        .content { flex: 1; }
        .title { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px; }
        .logo-text { display: flex; gap: 8px; align-items: center; flex-direction: column; }
        .logo-svg { width: 40px; height: 40px; }
        .description { font-size: 14px; color: #6b7280; }
        .close { color: #9ca3af; font-size: 20px; cursor: pointer; border: none; background: none; }
        .close:hover { color: #6b7280; }
        .buttons { display: flex; gap: 8px; margin-top: 16px; }
        .button { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; border-radius: 24px; font-size: 16px; font-weight: 500; text-decoration: none; transition: background-color 0.2s; flex: 1; }
        .button.primary { background-color: #2563eb; color: white; }
        .button.primary:hover { background-color: #1d4ed8; }
        .button.secondary { background-color: transparent; color: #374151; border: 1px solid #d1d5db; }
        .button.secondary:hover { background-color: #f9fafb; }
        .ios-message { font-size: 14px; color: #9ca3af; margin-top: 16px; }
        @media (max-width: 600px) { .buttons { flex-direction: column; } .button { width: 100%; } }
      </style>
    </head>
    <body>
      <div class="toast">
        <div class="header">
          <div class="content">
            <h3 class="title">${title}</h3>
            <div class="logo-text">
              <svg class="logo-svg w-48 h-48 drop-shadow-md" viewBox="0 0 100 100" fill="none" aria-label="OchoApp logo">
                <defs>
                    <linearGradient id="logoGradient" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                        <!-- CORRECTION: stop-color au lieu de stopcolor -->
                        <stop offset="0" stop-color="#157ff2"></stop>
                        <stop offset="1" stop-color="#0c50cc"></stop>
                    </linearGradient>
                </defs>
                <path d="M50,50 C30,30 20,10 50,10 C80,10 70,30 50,50 C30,70 20,90 50,90 C80,90 70,70 50,50 Z" 
                      fill="none" 
                      stroke="url(#logoGradient)" 
                      stroke-width="14" 
                      stroke-linecap="round" 
                      stroke-linejoin="round">
                </path>
            </svg>
              <p class="description">${description}</p>
            </div>
          </div>
        </div>
        <div class="buttons">
          ${isMobile ? (isAndroid ? `
            <a href="ochoapp://home" class="button primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Ouvrir</span>
            </a>
            <a href="https://github.com/MartinOcho/ocho-app/releases/download/app/app-release.apk" class="button secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Télécharger</span>
            </a>
          ` : isIOS ? `
            <div class="ios-message">
              <p>Disponible sur l'App Store</p>
              <p>Recherchez "OchoApp" sur l'App Store pour télécharger.</p>
            </div>
          ` : '') : `
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="button primary">Accéder à l'accueil</a>
          `}
        </div>
        <noscript>
          <p>Version texte : ${description} Pour mobile Android, ouvrez l'application avec ochoapp://home ou téléchargez depuis https://github.com/MartinOcho/ocho-app/releases/download/app/app-release.apk. Pour desktop, accédez à ${process.env.CLIENT_URL || 'http://localhost:3000'}.</p>
        </noscript>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

app.post("/api/cloudinary/upload", async (req, res) => {
  try {
    const body = req.body || {};
    const file = body.file;
    if (!file)
      return res
        .status(400)
        .json({ success: false, error: "No file provided" });

        const fileExtension = getFileExtension(file);

        const fileName = file.name || `ochoapp_${Date.now()}.${fileExtension}`;


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
        fileName,
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
  "/api/cloudinary/upload-attachment",
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

      const attachmentType: MediaType | undefined =
        uploadResult.resource_type &&
        String(uploadResult.resource_type).startsWith("video")
          ? "VIDEO"
          : uploadResult.resource_type === "image" ||
              (uploadResult.secure_url &&
                /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(
                  uploadResult.secure_url,
                ))
            ? "IMAGE"
            : undefined;

      if (!attachmentType) {
        return res
          .status(400)
          .json({ success: false, error: "Unsupported file type" });
      }

      const mediaAttachment = await prisma.media.create({
        data: {
          type: attachmentType,
          url: uploadResult.secure_url || uploadResult.url || "",
        }
      })

      return res.json({
        success: true,
        attachmentId: mediaAttachment.id,
        attachmentUrl: mediaAttachment.url,
        attachmentType: mediaAttachment.type
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
app.post(
  "/api/cloudinary/upload-multipart",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer)
        return res.json({ success: false, error: "No file provided" });

      const fileLike: FileLike | undefined = file
        ? {
            name: file.originalname,
            type: file.mimetype,
          }
        : undefined;

      const fileExtension = getFileExtension(fileLike);

      const fileName = file.filename || `ochoapp_${Date.now()}.${fileExtension}`;

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
          fileName,
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
        attachmentUrl: messageAttachment.url,
        attachmentType: messageAttachment.type,
      });
    } catch (err) {
      console.error("Proxy multipart upload error", err);
      return res.json({
        success: false,
        error: "Upload failed",
        message: err instanceof Error ? err.message : undefined,
      });
    }
  },
);

app.post(
  "/api/cloudinary/upload-user-avatar",
  upload.single("file"),
  async (req, res) => {
    try {
      const { sessionId } = req.body as { sessionId?: string };
      if (!sessionId) {
        return res
          .status(400)
          .json({ success: false, error: "Missing sessionId" });
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!session || !session.user) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid session" });
      }

      const userId = session.user.id;

      const file = req.file;
      if (!file || !file.buffer)
        return res
          .status(400)
          .json({ success: false, error: "No file provided" });

      const publicId = `user_avatars/${userId}_${randomUUID()}`;

      const streamUpload = (buffer: Buffer) =>
        new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "auto",
              public_id: publicId,
              folder: "user_avatars",
              overwrite: true,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result as UploadApiResponse);
            },
          );
          stream.end(buffer);
        });

      const uploadResult = await streamUpload(file.buffer);

      const url = uploadResult.secure_url || uploadResult.url || "";
      const public_id = uploadResult.public_id || null;
      const resourceType = uploadResult.resource_type || null;

      // Remove any old avatars for this user (both DB records and Cloudinary assets)
      const oldAvatars = await prisma.userAvatar.findMany({
        where: { userId },
        select: { id: true, publicId: true },
      });

      await prisma.userAvatar.deleteMany({
        where: {
          id: {
            in: oldAvatars.map((a) => a.id),
          },
        },
      });

      await Promise.all(
        oldAvatars.map(async (old) => {
          if (old.publicId) {
            return cloudinary.uploader.destroy(old.publicId).catch((err) => {
              console.error(
                "Error deleting old user avatar from Cloudinary:",
                err,
              );
            });
          }
          return Promise.resolve();
        }),
      );

      const userAvatar = await prisma.userAvatar.create({
        data: {
          userId,
          url,
          publicId: public_id,
          width: uploadResult.width || null,
          height: uploadResult.height || null,
          format: uploadResult.format || null,
          resourceType,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: url },
      });

      return res.json({ success: true, avatar: userAvatar });
    } catch (err) {
      console.error("Proxy avatar upload error", err);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        details: err instanceof Error ? err.message : undefined,
      });
    }
  },
);

app.post(
  "/api/cloudinary/upload-group-avatar",
  upload.single("file"),
  async (req, res) => {
    try {
      const { sessionId, roomId } = req.body as { sessionId?: string; roomId?: string };
      if (!sessionId || !roomId) {
        return res
          .status(400)
          .json({ success: false, error: "Missing sessionId or roomId" });
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!session || !session.user) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid session" });
      }

      const userId = session.user.id;

      const file = req.file;
      if (!file || !file.buffer)
        return res
          .status(400)
          .json({ success: false, error: "No file provided" });

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          members: {
            where: { userId },
            select: { type: true },
          },
        },
      });

      if (!room || !room.isGroup) {
        return res
          .status(404)
          .json({ success: false, error: "Group not found" });
      }

      const member = room.members[0];
      if (!member || !["ADMIN", "OWNER"].includes(member.type)) {
        return res
          .status(403)
          .json({ success: false, error: "Insufficient permissions" });
      }

      const publicId = `group_avatars/${roomId}_${randomUUID()}`;

      const streamUpload = (buffer: Buffer) =>
        new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "auto",
              folder: "group_avatars",
              public_id: publicId,
              overwrite: true,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result as UploadApiResponse);
            },
          );
          stream.end(buffer);
        });

      const uploadResult = await streamUpload(file.buffer);

      const url = uploadResult.secure_url || uploadResult.url || "";
      const public_id = uploadResult.public_id || null;

      // Supprimer l'ancien avatar du groupe si présent
      const oldAvatarUrl = room.groupAvatarUrl;
      if (oldAvatarUrl && oldAvatarUrl.includes("cloudinary")) {
        const oldPublicId = oldAvatarUrl.split("/").pop()?.split(".")[0];
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId);
          } catch (error) {
            console.error("Error deleting old group avatar from Cloudinary:", error);
          }
        }
      }

      await prisma.room.update({
        where: { id: roomId },
        data: { groupAvatarUrl: url },
      });

      return res.json({ success: true, avatarUrl: url });
    } catch (err) {
      console.error("Proxy group avatar upload error", err);
      return res.status(500).json({
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

  socket.on("search_rooms", async (data: SocketSearchRoomsEvent): Promise<void> => {
    const { query, roomId, cursor } = data;
    try {
      const response = await searchRooms(userId, username, query, roomId, cursor);
      socket.emit("search_results", response);
    } catch (error) {
      socket.emit("error_message", "Impossible de rechercher les discussions.");
    }
  });

  socket.on("get_room_details", async (data: SocketGetRoomDetailsEvent) => {
    try {
      const roomDetails = await handleGetRoomDetails(data, userId);
      socket.emit("room_details", roomDetails);
    } catch (error) {
      console.error("Erreur get_room_details:", error);
      socket.emit("error_message", "Impossible de récupérer les détails de la discussion.");
    }
  });

  socket.on("get_last_message", async (data: SocketGetLastMessageEvent) => {
    try {
      const lastMessage = await handleGetLastMessage(data, userId);
      socket.emit("last_message", lastMessage);
    } catch (error) {
      console.error("Erreur get_last_message:", error);
      socket.emit("error_message", "Impossible de récupérer le dernier message.");
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

      // 3. Mise à jour des détails de la room (messages non lus)
      try {
        const roomDetails = await handleGetRoomDetails({ roomId }, userId);
        io.to(userId).emit("room_details", roomDetails);
      } catch (error) {
        console.error("Error emitting room_details in mark_message_read:", error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Message not found")) {
        io.to(roomId).emit("message_deleted", {
          messageId,
          roomId,
        });
      } else {
        console.error("Erreur mark_message_read:", error);
      }
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("Message not found")) {
          io.to(roomId).emit("message_deleted", {
            messageId,
            roomId,
          });
        } else {
          console.error("Erreur mark_message_delivered:", error);
        }
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Message not found")) {
        io.to(data.roomId).emit("message_deleted", {
          messageId: data.messageId,
          roomId: data.roomId,
        });
      } else {
        console.error("Erreur add_reaction:", error);
        socket.emit("error", { message: "Impossible d'ajouter la réaction" });
      }
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Message not found")) {
        io.to(data.roomId).emit("message_deleted", {
          messageId: data.messageId,
          roomId: data.roomId,
        });
      } else {
        console.error("Erreur remove_reaction:", error);
        socket.emit("error", {
          message: "Impossible de supprimer la réaction",
        });
      }
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
      issuerId?: string;
      postId?: string;
      commentId?: string;
    }) => {
      try {
        const { type, recipientId, issuerId, postId, commentId } = data;
        if (!recipientId || !type) return;
        if (userId === recipientId) return;

        const alreadyExists = await prisma.notification.findFirst({
          where: {
            AND: [
              { type: type },
              { recipientId: recipientId },
              { issuerId: issuerId || userId || undefined },
              { postId: postId || undefined },
              { commentId: commentId || undefined },
            ]
          },
        })
        if (alreadyExists) {
          const notification = await prisma.notification.update({
            where: {
              id: alreadyExists.id
            },
            data: {
              read: false,
              createdAt: new Date()
            },
            include: notificationsInclude
          })

          io.to(recipientId).emit("notification_received", notification);
        }else{
          const notification = await prisma.notification.create({
            data: {
              type,
              recipientId,
              issuerId:  issuerId || userId,
              postId,
              commentId,
            },
            include: notificationsInclude,
          });
          
          io.to(recipientId).emit("notification_received", notification);
        }

        const unreadCount = await prisma.notification.count({
          where: { recipientId, read: false },
        });
        io.to(recipientId).emit("notifications_unread_update", { unreadCount });
      } catch (e) {
        console.error("Erreur create_notification socket:", e);
      }
    },
  );

  // mark a single notification as read
  socket.on("mark_notification_read", async (data: { notificationId: string }) => {
    try {
      const { notificationId } = data;
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId, recipientId: userId },
      });
      if (notification && !notification.read) {
        const updated = await prisma.notification.update({
          where: { id: notificationId },
          data: { read: true },
        });
        io.to(userId).emit("notification_read", updated);
        const unreadCount = await prisma.notification.count({
          where: { recipientId: userId, read: false },
        });
        io.to(userId).emit("notifications_unread_update", { unreadCount });
      }
    } catch (e) {
      console.error("Erreur mark_notification_read socket:", e);
    }
  });

  // mark all notifications as read
  socket.on("mark_all_notifications_read", async () => {
    try {
      await prisma.notification.updateMany({
        where: { recipientId: userId, read: false },
        data: { read: true },
      });
      io.to(userId).emit("all_notifications_marked_as_read");
      io.to(userId).emit("notifications_unread_update", { unreadCount: 0 });
    } catch (e) {
      console.error("Erreur mark_all_notifications_read socket:", e);
    }
  });

  socket.on("delete_many_notifications", async (data: { postId?: string, commentId?: string }) => {
    try {
      const { postId, commentId } = data;
      const notifications = await prisma.notification.findMany({
        where: {
          AND: [
            { postId: postId || undefined },
            { commentId: commentId || undefined },
          ]
        }
      });

      for (const notification of notifications) {
        const notificationDeleted = await prisma.notification.delete({
          where: {
            id: notification.id,
          },
        });

        if(notificationDeleted) {
          io.to(notification.recipientId).emit("delete_notification", {
            type: notification.type,
            recipientId: notification.recipientId,
            postId: notification.postId || undefined,
            commentId: notification.commentId || undefined,
          });
        }
      }
      
    } catch (e) {
      console.error("Erreur delete_many_notifications socket:", e);
    }
  });

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

        const notification = await prisma.notification.findFirst({
          where: {
            type,
            recipientId,
            issuerId: userId,
            postId: postId || undefined,
            commentId: commentId || undefined,
          },
          include: notificationsInclude,
        })
        if (notification) {
          await prisma.notification.delete({
            where: {
              id: notification.id
            }
          })
          io.to(recipientId).emit("notification_deleted", notification);
  
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
