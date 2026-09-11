import { MetadataRoute } from 'next'
import prisma from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ochoapp.ochokom.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-01-01'),
    },
    {
      url: `${baseUrl}/terms-of-use`,
      lastModified: new Date('2026-01-01'),
    },
  ]

  const posts = await prisma.post.findMany({
    where: {
      visibility: 'PUBLIC',
      content: {
        not: "",
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1000,
    select: {
      id: true,
      createdAt: true,
    },
  })

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.id}`,
    lastModified: post.createdAt,
  }))

  const users = await prisma.user.findMany({
    where: {
      profileVisibility: 'PUBLIC',
    },
    select: {
      username: true,
      createdAt: true,
      bio: true,
      avatarUrl: true,
      posts: {
        where: {
          visibility: 'PUBLIC',
          content: {
            not: '',
          },
        },
        select: {
          id: true,
          content: true,
        },
        take: 1,
      },
    },
  })

  const userRoutes: MetadataRoute.Sitemap = users
    .filter(
      (user) =>
        user.posts.some((post) => post.content?.trim().length > 0) ||
        (!!user.avatarUrl && !!user.bio?.trim()),
    )
    .map((user) => ({
      url: `${baseUrl}/users/${user.username}`,
      lastModified: user.createdAt,
    }))

  return [...staticRoutes, ...postRoutes, ...userRoutes]
}
