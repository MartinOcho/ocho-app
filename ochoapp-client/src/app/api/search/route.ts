import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getPostDataIncludes,
  getUserDataSelect,
  SearchFilter,
  SearchPage,
} from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const filter =
      (req.nextUrl.searchParams.get("filter") as SearchFilter) || "posts";
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const searchQuery = q
      .split(" ")
      .map((term) => `${term}:*`)
      .join(" & ");
    const pageSize = 10;

    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    let results;
    switch (filter) {
      case "posts":
        results = await prisma.post.findMany({
          where: {
            OR: [
              { content: { search: searchQuery } },
              { user: { displayName: { search: searchQuery } } },
              { user: { username: { search: searchQuery } } },
            ],
          },
          include: getPostDataIncludes(user.id),
          orderBy: { createdAt: "desc" },
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "users":
        results = await prisma.user.findMany({
          where: {
            AND: [
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "friend":
        results = await prisma.user.findMany({
          where: {
            AND: [
              {
                NOT: {
                  id: user.id,
                },
              },
              {
                AND: [
                  { followers: { some: { followerId: user.id } } },
                  { following: { some: { followingId: user.id } } },
                ],
              },
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "followers":
        results = await prisma.user.findMany({
          where: {
            AND: [
              {
                NOT: {
                  id: user.id,
                },
              },
              { following: { some: { followingId: user.id } } },
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "following":
        results = await prisma.user.findMany({
          where: {
            AND: [
              {
                NOT: {
                  id: user.id,
                },
              },
              { followers: { some: { followerId: user.id } } },
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "verified-users":
        results = await prisma.user.findMany({
          where: {
            AND: [
             
              {
                verified: {
                  some: {}
                },
              },
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      case "unrelated-users":
        results = await prisma.user.findMany({
          where: {
            AND: [
              {
                NOT: {
                  id: user.id,
                },
              },
              {
                NOT: {
                  OR: [
                    { followers: { some: { followerId: user.id } } },
                    { following: { some: { followingId: user.id } } },
                  ],
                },
              },
              {
                OR: [
                  { displayName: { search: searchQuery } },
                  { username: { search: searchQuery } },
                  { displayName: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: getUserDataSelect(user.id),
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
        break;
      default:
        results = await prisma.post.findMany({
          where: {
            OR: [
              { content: { search: searchQuery } },
              { user: { displayName: { search: searchQuery } } },
              { user: { username: { search: searchQuery } } },
            ],
          },
          include: getPostDataIncludes(user.id),
          orderBy: { createdAt: "desc" },
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        });
    }

    const nextCursor = results.length > pageSize ? results[pageSize].id : null;
    const data: SearchPage = {
      posts: results.slice(0, pageSize),
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
