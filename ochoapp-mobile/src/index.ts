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
  res.json({ message: "Hello from the mobile server" });
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
        attachmentType: messageAttachment.type
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



server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(chalk.blueBright(`🚀 Serveur des api mobile prêt sur le port ${PORT}`));
});
