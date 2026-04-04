import { Metadata } from 'next';
import VendorStorefrontClient from './VendorStorefrontClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getVendor(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/vendor/slug/${slug}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const vendor = await getVendor(params.slug);
  if (!vendor) return { title: 'Store Not Found' };

  return {
    title: `${vendor.storeName} | Top Vendor on MODCART`,
    description: vendor.description || `Shop high-quality products from ${vendor.storeName} on Modcart. Digital-first premium marketplace experience.`,
    openGraph: {
      title: vendor.storeName,
      description: vendor.description,
      images: vendor.logo ? [{ url: vendor.logo }] : [],
    }
  };
}

export default async function VendorPage({ params }: { params: { slug: string } }) {
  const vendor = await getVendor(params.slug);
  
  return <VendorStorefrontClient initialVendor={vendor} slug={params.slug} />;
}
