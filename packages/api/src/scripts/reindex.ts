import { prisma } from '@modcart/db';
import { indexProduct, initIndex } from '@modcart/search';
import { Prisma } from '@prisma/client';

type ProductWithIncludes = Prisma.ProductGetPayload<{
  include: {
    vendor: true,
    categories: { include: { category: true } },
    images: true
  }
}>;

export async function runReindex() {
  console.log('🔄 Starting full re-index...');
  await initIndex();
  
  const products: ProductWithIncludes[] = await prisma.product.findMany({
    include: {
      vendor: true,
      categories: { include: { category: true } },
      images: true
    }
  });

  console.log(`📦 Found ${products.length} products to index.`);

  for (const p of products) {
    await indexProduct({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: Number(p.price),
      vendorId: p.vendorId,
      vendorName: p.vendor.storeName,
      categories: p.categories.map(c => c.category.name),
      imageUrl: p.images[0]?.url || '',
      imageUrls: p.images.map(img => img.url),
      isVerified: true
    });
    console.log(`✅ Indexed: ${p.name}`);
  }

  console.log('✨ Re-indexing complete!');
}
