import { prisma } from '@modcart/db';
import { indexProduct, initIndex } from '@modcart/search';

async function reindex() {
  console.log('🔄 Initializing index...');
  await initIndex();

  console.log('📦 Fetching products from database...');
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      categories: { include: { category: true } },
      vendor: true,
    },
  });

  console.log(`🚀 Indexing ${products.length} products...`);
  
  for (const product of products) {
    await indexProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      vendorId: product.vendorId,
      vendorName: product.vendor.storeName,
      categories: product.categories.map(c => (c as any).category.name),
      imageUrl: product.imageUrl,
    });
    console.log(`✅ Indexed: ${product.name}`);
  }

  console.log('✨ Re-indexing complete!');
  process.exit(0);
}

reindex().catch(err => {
  console.error('❌ Re-indexing failed:', err);
  process.exit(1);
});
