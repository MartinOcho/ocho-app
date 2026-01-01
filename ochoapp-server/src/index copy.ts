import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Configuration
const PORT = process.env.PORT || 4000;
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_key_change_me_in_prod";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({ origin: CLIENT_URL, methods: ["GET", "POST"], credentials: true })
);
app.use(express.json());

// Socket.io Setup
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"], credentials: true },
  pingTimeout: 60000,
});

// --- TYPES & UTILS ---
interface AuthRequest extends express.Request {
  user?: { userId: string };
}

const authenticateToken = (
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Map pour suivre les statuts en temps réel : userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

// --- ROUTES AUTH ---

app.post("/api/register", async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;

    if (!username || !email || !password || !displayName) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "Email ou nom d'utilisateur déjà pris" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        displayName,
        email,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${username}&backgroundColor=e5e7eb`,
      },
    });

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid)
      return res.status(401).json({ error: "Identifiants invalides" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- ROUTES API (MESSAGERIE) ---

app.get("/api/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.user!.userId } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        username: true,
        lastSeen: true,
      },
      orderBy: { displayName: "asc" },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Erreur récupération utilisateurs" });
  }
});

app.post("/api/rooms", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, isGroup, memberIds } = req.body;
    const userId = req.user!.userId;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "Sélectionnez au moins un membre" });
    }

    // Gestion des chats privés existants
    if (!isGroup && memberIds.length === 1) {
      const targetId = memberIds[0];
      const existingRoom = await prisma.room.findFirst({
        where: {
          isGroup: false,
          members: {
            every: { userId: { in: [userId, targetId] } },
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, displayName: true, avatarUrl: true, lastSeen: true } },
            },
          },
        },
      });

      // Si une room existe et a exactement ces 2 membres
      if (existingRoom && existingRoom.members.length === 2) {
        return res.json(existingRoom);
      }
    }

    // Création de la room
    const room = await prisma.room.create({
      data: {
        name: isGroup ? name : null,
        isGroup: !!isGroup,
        members: {
          create: [
            { userId, type: "OWNER" },
            ...memberIds.map((id: string) => ({ userId: id })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true, lastSeen: true } },
          },
        },
      },
    });

    // Initialisation LastMessage vide pour le tri
    await Promise.all(
      room.members.map((m) =>
        prisma.lastMessage.create({
          data: { userId: m.userId!, roomId: room.id },
        })
      )
    );

    // NOTIFICATION TEMPS RÉEL AUX MEMBRES (Nouveau)
    // On notifie tous les membres connectés qu'une nouvelle room a été créée pour eux
    room.members.forEach(member => {
        if(member.userId && member.userId !== userId) { // On n'envoie pas au créateur ici (géré par la réponse HTTP)
             const sockets = onlineUsers.get(member.userId);
             if(sockets) {
                // On structure comme une Conversation pour le frontend
                const conversationPayload = {
                    userId: member.userId,
                    roomId: room.id,
                    message: null,
                    room: room
                };
                sockets.forEach(socketId => {
                    io.to(socketId).emit('room_added', conversationPayload);
                });
             }
        }
    });

    res.json(room);
  } catch (error) {
    console.error("Create Room Error:", error);
    res.status(500).json({ error: "Impossible de créer la discussion" });
  }
});

app.get(
  "/api/conversations",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const conversations = await prisma.lastMessage.findMany({
        where: { userId },
        include: {
          room: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                      avatarUrl: true,
                      lastSeen: true,
                    },
                  },
                },
              },
            },
          },
          message: { include: { sender: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Erreur récupération conversations" });
    }
  }
);

app.get(
  "/api/messages/:roomId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { roomId } = req.params;
      const userId = req.user!.userId;

      const membership = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });

      if (!membership) return res.status(403).json({ error: "Accès refusé" });

      const messages = await prisma.message.findMany({
        where: { roomId },
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          reads: true,
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });

      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Erreur récupération messages" });
    }
  }
);

// --- SOCKET.IO LOGIC ---

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    // @ts-ignore
    socket.data.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.data.userId;

  // Gestion Online
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);

  // Mettre à jour la DB et notifier tout le monde
  if (onlineUsers.get(userId)!.size === 1) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    });
    io.emit("user_status_change", { userId, isOnline: true });
  }

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  socket.on("send_message", async ({ roomId, content, type = "CONTENT" }) => {
    try {
      // 1. Sauvegarde Message
      const message = await prisma.message.create({
        data: { content, roomId, senderId: userId, type },
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          reads: true,
        },
      });

      // 2. Mise à jour LastMessage
      const members = await prisma.roomMember.findMany({
        where: { roomId },
        select: { userId: true },
      });
      await Promise.all(
        members.map((m) => {
          if (!m.userId) return;
          return prisma.lastMessage.upsert({
            where: { userId_roomId: { userId: m.userId, roomId } },
            create: {
              userId: m.userId,
              roomId,
              messageId: message.id,
              createdAt: new Date(),
            },
            update: { messageId: message.id, createdAt: new Date() },
          });
        })
      );

      // 3. Emit aux clients dans la room (pour le chat actif)
      io.to(roomId).emit("new_message", message);

      // 4. Emit pour mettre à jour la liste des conversations (Sidebar)
      // On envoie à tous les membres connectés
      members.forEach((m) => {
        if (m.userId) {
          const userSockets = onlineUsers.get(m.userId);
          if (userSockets) {
            userSockets.forEach(socketId => {
                 io.to(socketId).emit("update_conversation", {
                    roomId,
                    lastMessage: message,
                  });
            });
          }
        }
      });
    } catch (e) {
      console.error("Send Message Error", e);
    }
  });

  socket.on("mark_read", async ({ roomId, messageId }) => {
    try {
      await prisma.read.upsert({
        where: { userId_messageId: { userId, messageId } },
        create: { userId, messageId },
        update: { readAt: new Date() },
      });
      io.to(roomId).emit("message_read", { messageId, userId });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("typing_start", (roomId) => {
    
    socket.to(roomId).emit("user_typing", { roomId, userId, isTyping: true });
  });

  socket.on("typing_stop", (roomId) => {
    socket.to(roomId).emit("user_typing", { roomId, userId, isTyping: false });
  });

  socket.on("disconnect", async () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        const lastSeen = new Date();
        await prisma.user.update({ where: { id: userId }, data: { lastSeen } });
        io.emit("user_status_change", { userId, isOnline: false, lastSeen });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});