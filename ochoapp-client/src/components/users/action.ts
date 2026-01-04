"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { updateUserProfileSchema } from "@/lib/validation";
import argon2 from "argon2";
import CryptoJS from "crypto-js";

export async function updateUser({
  displayName,
  bio,
  birthday,
}: {
  displayName?: string;
  bio?: string;
  birthday?: Date;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { displayName: validatedDisplayName, bio: validatedBio, birthday: validatedBirthday } =
    updateUserProfileSchema.parse({ displayName, bio, birthday });

  if (validatedBirthday) {
    const today = new Date();
    const age = today.getFullYear() - validatedBirthday.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > validatedBirthday.getMonth() ||
      (today.getMonth() === validatedBirthday.getMonth() &&
        today.getDate() >= validatedBirthday.getDate());
    if (age < 13 || (age === 13 && !hasHadBirthdayThisYear)) {
      throw new Error("Vous devez avoir au moins 13 ans.");
    }
  }

  const data: {
    displayName?: string;
    bio?: string;
    birthday?: Date;
  } = {};
  if (validatedDisplayName !== undefined) data.displayName = validatedDisplayName;
  if (validatedBio !== undefined) data.bio = validatedBio;
  if (validatedBirthday !== undefined) data.birthday = validatedBirthday;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      birthday: true,
    },
  });

  return updatedUser;
}

export async function updatePassword({
  currentPassword,
  password,
}: {
  currentPassword?: string;
  password: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (!dbUser) {
    throw new Error("User not found");
  }

  // Verify current password if user has one
  if (dbUser.passwordHash && currentPassword) {
    const isCurrentPasswordValid = await argon2.verify(dbUser.passwordHash, currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }
  }

  const hashedPassword = await argon2.hash(password);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashedPassword },
  });

  return { success: true };
}

export async function updateUsername({
  username,
}: {
  username: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lastUsernameChange: true, username: true }
  });

  if (!dbUser) {
    throw new Error("User not found");
  }

  // Check username change restriction (once per month)
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (dbUser.lastUsernameChange && dbUser.lastUsernameChange > oneMonthAgo) {
    throw new Error("Username can only be changed once per month");
  }

  // Check if new username is already taken
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    throw new Error("Username already taken");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      lastUsernameChange: new Date()
    },
  });

  return { success: true };
}

export async function hasPassword() {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!dbUser) {
    throw new Error("User not found");
  }

  return { hasPassword: !!dbUser.passwordHash };
}

export async function exportUserData() {
  const { user } = await validateRequest();

  if (!user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = user.id;

  // Fetch user data
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      birthday: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      lastSeen: true,
      // Exclude sensitive data like passwordHash
    }
  });

  if (!userData) {
    throw new Error("User not found");
  }

  // Fetch user's posts
  const posts = await prisma.post.findMany({
    where: { userId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      gradient: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch user's comments
  const comments = await prisma.comment.findMany({
    where: { userId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      postId: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch user's likes
  const likes = await prisma.like.findMany({
    where: { userId },
    select: {
      postId: true,
    }
  });

  // Fetch user's bookmarks
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    select: {
      postId: true,
      createdAt: true,
    }
  });

  // Fetch user's search history
  const searchHistory = await prisma.searchHistory.findMany({
    where: { userId },
    select: {
      query: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Compile all user data
  const exportData = {
    user: userData,
    posts: posts,
    comments: comments,
    likes: likes,
    bookmarks: bookmarks,
    searchHistory: searchHistory,
    exportDate: new Date().toISOString(),
    note: "This export contains your public data and activity. Sensitive information like passwords is not included."
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const secretKey = process.env.INTERNAL_SERVER_SECRET;
  if (!secretKey) {
    throw new Error("INTERNAL_SERVER_SECRET environment variable is not set");
  }
  const encryptedData = CryptoJS.AES.encrypt(jsonString, secretKey).toString();

  return encryptedData;
}
