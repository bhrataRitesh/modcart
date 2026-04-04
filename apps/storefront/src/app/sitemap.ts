import { MetadataRoute } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch vendors
  let vendors = [];
  try {
    const res = await fetch(`${API_URL}/api/v1/vendor/public-list`);
    if (res.ok) vendors = await res.json();
  } catch (e) {
    console.error('Sitemap fetch failed', e);
  }

  const vendorEntries: MetadataRoute.Sitemap = vendors.map((v: any) => ({
    url: `https://modcart.io/vendors/${v.storeSlug}`,
    lastModified: new Date(v.createdAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: 'https://modcart.io',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...vendorEntries,
  ]
}
