import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/messages/',
        '/notifications/',
        '/settings/',
        '/search/',
      ],
    },
    sitemap: 'https://ochoapp.ochokom.com/sitemap.xml',
  }
}
