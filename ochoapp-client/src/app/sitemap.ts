import { MetadataRoute } from 'next'
import prisma from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ochoapp.ochokom.com'

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms-of-use`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    }
  ]

  // Dynamic public posts (top 1000 most recent for example)
  const posts = await prisma.post.findMany({
    where: {
      visibility: 'PUBLIC',
    },
    orderBy: {
      relevanceScore: 'desc',
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
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Dynamic public users (top 1000 for example)
  const users = await prisma.user.findMany({
    where: {
      profileVisibility: 'PUBLIC',
    },
    take: 1000,
    select: {
      username: true,
      createdAt: true,
    },
  })

  const userRoutes: MetadataRoute.Sitemap = users.map((user) => ({
    url: `${baseUrl}/users/${user.username}`,
    lastModified: user.createdAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...postRoutes, ...userRoutes]
}
