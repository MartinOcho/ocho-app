import express from "express";
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
  getUserProfile,
  updateUserProfile,
  toggleFollow,
  getSuggestedUsers,
  getPost,
  deletePost,
  toggleLike,
  toggleBookmark,
  getComments,
  sendComment,
  getNotifications,
  getMessageRooms,
  searchMessageUsers,
  getMessageDeliveries,
  getMessageReactions,
  getMessageReads,
  getPostsForYou,
  getFollowingPosts,
  getBookmarkedPosts,
  createPost,
  getUserPosts,
  createSession,
  getTrendingHashtags,
  getCommentReplies,
  sendCommentReply,
} from "./utils";
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
  res.json({ message: "Hello from the mobile server" });
});

app.post("/api/signup", signupUser);
app.post("/api/login", loginUser);
app.post("/api/session/refresh", createSession);

app.get("/api/users/suggested", getSuggestedUsers);
app.get("/api/users/:userId", getUserProfile);
app.patch("/api/users/:userId", updateUserProfile);
app.get("/api/users/:userId/follow", toggleFollow);

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


app.get("/api/comments/:commentId/replies", getCommentReplies);
app.post("/api/comments/reply", sendCommentReply);


app.get("/api/notifications", getNotifications);

app.get("/api/messages/rooms", getMessageRooms);
app.get("/api/messages/users", searchMessageUsers);
app.get("/api/messages/:messageId/deliveries", getMessageDeliveries);
app.get("/api/messages/:messageId/reactions", getMessageReactions);
app.get("/api/messages/:messageId/reads", getMessageReads);


app.get("/api/check-update", (req: Request, res: Response) => {
  const version = (req.query.version || "").toString();
  const platform = (req.query.platform || "").toString();
  const androidCurrentVersion = 1;
  const androidVersionName = "0.1.0";
  const iosCurrentVersion = 1;
  const iosVersionName = "0.1.0";
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
    return res.status(500).json({
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
      return res.status(500).json({
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
        attachmentUrl: messageAttachment.url,
        attachmentType: messageAttachment.type,
      });
    } catch (err) {
      console.error("Proxy multipart upload error", err);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        details: err instanceof Error ? err.message : undefined,
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
      const { sessionId, roomId } = req.body as {
        sessionId?: string;
        roomId?: string;
      };
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
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        details: err instanceof Error ? err.message : undefined,
      });
    }
  },
);

// 404 handler: always JSON
app.use((req, res) => {
  res
    .status(404)
    .type("application/json")
    .json({
      success: false,
      error: "Not Found",
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    });
});

// Global error handler: convert all errors to JSON (no HTML)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled API error", err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err?.status || err?.statusCode || 500;
  const errorMessage =
    err?.message || (status === 404 ? "Not Found" : "Internal Server Error");

  res
    .status(status)
    .type("application/json")
    .json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? err instanceof Error
            ? err.stack
            : err
          : undefined,
    });
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(
    chalk.blueBright(`🚀 Serveur des api mobile prêt sur le port ${PORT}`),
  );
});
