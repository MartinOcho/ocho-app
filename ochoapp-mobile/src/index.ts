import express, { ErrorRequestHandler, NextFunction } from "express";
import http from "http";
import { Request, Response } from "express";
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
  loginUser,
  signupUser,
  logoutUser,
} from "./auth";
import {
  getUserProfile,
  updateUserProfile,
  toggleFollow,
  getSuggestedUsers,
  getUserSettings,
  updateUserPrivacy,
  updateUserBirthday,
  updateUsername,
  exportUserData,
  disableUserAccount,
  deleteUserAccount,
} from "./users";
import {
  getActivityHistory,
  getUserPostsActivity,
  getUserLikes,
  getUserBookmarks,
  getUserComments,
  getUserRoomJoins,
  getUserRoomLeaves,
  getUserRoomCreations,
  getUserSearches,
} from "./activity";
import {
  getPost,
  deletePost,
  toggleLike,
  toggleBookmark,
  getComments,
  sendComment,
  getNotifications,
  getMessageRooms,
  getRoom,
  getMessages,
  getRoomMedias,
  getUnreadMessagesCount,
  searchMessageUsers,
  getMessageUsersByFilter,
  getMessageDeliveries,
  getMessageReactions,
  getMessageReads,
  updateRoom,
  getPostsForYou,
  getFollowingPosts,
  getBookmarkedPosts,
  createPost,
  getUserPosts,
  createSession,
  getTrendingHashtags,
  getCommentReplies,
  sendCommentReply,
  likeComment,
  deleteComment,
  getUnreadNotificationCount,
  getLastMessage,
  getUnreadRoomsCount,
  validateUser,
} from "./utils";
import {
  getSearchHistory,
  deleteSearchQuery,
  saveSearchQuery,
  searchAll,
  searchPost,
  searchPostIds,
  searchGeneral,
  searchUsers,
  searchHashtags,
  searchPostsFiltered,
} from "./search";
import { ApiResponse } from "./types";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const allowedOrigins = [
  CLIENT_URL,
  CLIENT_URL.replace(/\/$/, ""),
  CLIENT_URL.endsWith("/") ? CLIENT_URL : CLIENT_URL + "/",
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
  methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Device-ID",
    "X-Device-Type",
    "X-Device-Model",
  ],
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

app.post("/api/signup", signupUser);
app.post("/api/login", loginUser);
app.post("/api/session/refresh", createSession);

app.get("/api/users/suggested", getSuggestedUsers);
app.get("/api/users/:userId", getUserProfile);
app.patch("/api/users/:userId", updateUserProfile);
app.get("/api/users/:userId/follow", toggleFollow);

// Routes pour les paramètres utilisateur
app.get("/api/settings", getUserSettings);
app.patch("/api/settings/privacy", updateUserPrivacy);
app.patch("/api/settings/birthday", updateUserBirthday);
app.patch("/api/settings/username", updateUsername);
app.get("/api/settings/export", exportUserData);
app.post("/api/settings/disable", disableUserAccount);
app.delete("/api/settings/delete", deleteUserAccount);

// Routes pour créer un post
app.post("/api/posts", createPost);

// Routes spécifiques (avant les paramètres !)
app.get("/api/posts/for-you", getPostsForYou);
app.get("/api/posts/following", getFollowingPosts);
app.get("/api/posts/bookmarks", getBookmarkedPosts);
app.get("/api/posts/user/:userId", getUserPosts);

app.get("/api/trending/hashtags", getTrendingHashtags);

// Routes paramétrées (après les routes spécifiques)
app.get("/api/posts/:postId", getPost);
app.delete("/api/posts/:postId", deletePost);
app.post("/api/posts/:postId/like", toggleLike);
app.post("/api/posts/:postId/bookmark", toggleBookmark);
app.get("/api/posts/:postId/comments", getComments);
app.post("/api/posts/:postId/comments", sendComment);

app.post("/api/comments/reply", sendCommentReply);
app.get("/api/comments/:commentId/replies", getCommentReplies);
app.post("/api/comments/:commentId/like", likeComment);
app.delete("/api/comments/:commentId", deleteComment);

app.get("/api/notifications", getNotifications);
app.get("/api/unread-count/notifications", getUnreadNotificationCount);

app.get("/api/messages/rooms", getMessageRooms);
app.get("/api/messages/rooms/unreads", getUnreadRoomsCount);
app.get("/api/messages/rooms/:roomId", getRoom);
app.get("/api/messages/rooms/:roomId/messages", getMessages);
app.get("/api/messages/rooms/:roomId/latest-message", getLastMessage);
app.get("/api/messages/rooms/:roomId/gallery/medias", getRoomMedias);
app.get("/api/messages/rooms/:roomId/unread-count", getUnreadMessagesCount);
app.get("/api/messages/users", searchMessageUsers);
app.get("/api/messages/users/:filter", getMessageUsersByFilter);
app.get("/api/messages/:messageId/deliveries", getMessageDeliveries);
app.get("/api/messages/:messageId/reactions", getMessageReactions);
app.get("/api/messages/:messageId/reads", getMessageReads);
app.patch("/api/messages/rooms/:roomId", updateRoom);

app.delete("/api/auth/logout", logoutUser);

// Routes de recherche
app.get("/api/search", searchGeneral);
app.get("/api/search/history", getSearchHistory);
app.post("/api/search/history", saveSearchQuery);
app.delete("/api/search/history/:queryId", deleteSearchQuery);
app.get("/api/search/all", searchAll);
app.get("/api/search/posts", searchPost);
app.get("/api/search/posts/filtered", searchPostsFiltered);
app.get("/api/search/posts/ids", searchPostIds);
app.get("/api/search/users", searchUsers);
app.get("/api/search/hashtags", searchHashtags);

app.get("/api/activity/history", getActivityHistory);

// Endpoints spécifiques par type d'activité
app.get("/api/activity/posts", getUserPostsActivity);
app.get("/api/activity/likes", getUserLikes);
app.get("/api/activity/bookmarks", getUserBookmarks);
app.get("/api/activity/comments", getUserComments);
app.get("/api/activity/rooms/joined", getUserRoomJoins);
app.get("/api/activity/rooms/left", getUserRoomLeaves);
app.get("/api/activity/rooms/created", getUserRoomCreations);
app.get("/api/activity/searches", getUserSearches);

app.get("/api/check-update", (req: Request, res: Response) => {
  const version = (req.query.version || "").toString();
  const platform = (req.query.platform || "").toString();
  const androidCurrentVersion = 1;
  const androidVersionName = "0.1.002";
  const iosCurrentVersion = 1;
  const iosVersionName = "0.1.002";
  let isUpToDate = true;
  if (platform.toLowerCase() === "android") {
    isUpToDate = parseInt(version) >= androidCurrentVersion;
  } else if (platform.toLowerCase() === "ios") {
    isUpToDate = parseInt(version) >= iosCurrentVersion;
  }
  const data = {
    isUpToDate: isUpToDate,
    currentVersion:
      platform.toLowerCase() === "android"
        ? androidCurrentVersion
        : iosCurrentVersion,
    downloadUrl:
      "https://github.com/MartinOcho/ocho-app/releases/download/app/app-release.apk",
    versionName:
      platform.toLowerCase() === "android"
        ? androidVersionName
        : iosVersionName,
  };

  return Response.json({
    success: true,
    data,
    message: isUpToDate
      ? "L'application est à jour."
      : "Une mise à jour est disponible.",
  } as ApiResponse<{
    isUpToDate: boolean;
    currentVersion: number;
    versionName: string;
    downloadUrl: string;
  }>);
});

app.post("/api/cloudinary/upload", async (req, res) => {
  try {
    const body = req.body || {};
    const file = body.file;
    if (!file) return res.json({ success: false, error: "No file provided" });

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
    return res.json({
      success: false,
      error: "Upload failed",
      message: err instanceof Error ? err.message : undefined,
    } as ApiResponse<null>);
  }
});

app.post(
  "/api/cloudinary/upload-attachment",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer)
        return res.json({ success: false, error: "No file provided" });

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
        return res.json({ success: false, error: "Unsupported file type" });
      }

      const mediaAttachment = await prisma.media.create({
        data: {
          type: attachmentType,
          url: uploadResult.secure_url || uploadResult.url || "",
        },
      });

      return res.json({
        success: true,
        attachmentId: mediaAttachment.id,
        attachmentUrl: mediaAttachment.url,
        attachmentType: mediaAttachment.type,
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
  "/api/cloudinary/upload-multipart",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer)
        return res.json({ success: false, error: "No file provided" });

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
        return res.json({ success: false, error: "Missing sessionId" });
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!session || !session.user) {
        return res.json({ success: false, error: "Invalid session" });
      }

      const userId = session.user.id;

      const file = req.file;
      if (!file || !file.buffer)
        return res.json({ success: false, error: "No file provided" });

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
      return res.json({
        success: false,
        error: "Upload failed",
        message: err instanceof Error ? err.message : undefined,
      });
    }
  },
);

app.post(
  "/api/:roomId/cloudinary/upload-group-avatar",
  upload.single("file"),
  async (req, res) => {
    try {
      const roomId = req.params.roomId;

      const { userData, user } = await validateUser(req, res);
      if (!user || !userData) {
        return res.json({
          success: false,
          message: "Utilisateur non authentifié.",
          name: "invalid_session",
        } as ApiResponse<null>);
      }
      const userId = user.id;

      const file = req.file;
      if (!file || !file.buffer)
        return res.json({ success: false, error: "No file provided" });

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
        return res.json({ success: false, error: "Group not found" });
      }

      const member = room.members[0];
      if (!member || !["ADMIN", "OWNER"].includes(member.type)) {
        return res.json({ success: false, error: "Insufficient permissions" });
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
            console.error(
              "Error deleting old group avatar from Cloudinary:",
              error,
            );
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
      return res.json({
        success: false,
        error: "Upload failed",
        details: err instanceof Error ? err.message : undefined,
      });
    }
  },
);

// 404 handler: always JSON
app.use((req, res) => {
  res.type("application/json")
    .json({
      success: false,
      error: "Not Found",
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    });
});

// Global error handler: convert all errors to JSON (no HTML)
app.use(
  (
    err: ErrorRequestHandler,
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    console.error("Unhandled API error", err);

    if (res.headersSent) {
      return next(err);
    }
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    console.error(err);

    res.type("application/json").json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? err instanceof Error
            ? err.stack
            : err
          : undefined,
    });
  },
);

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(
    chalk.blueBright(`🚀 Serveur des api mobile prêt sur le port ${PORT}`),
  );
});
