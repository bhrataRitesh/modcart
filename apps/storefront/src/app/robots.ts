import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/vendor-panel/'],
    },
    sitemap: 'https://modcart.io/sitemap.xml',
  }
}
