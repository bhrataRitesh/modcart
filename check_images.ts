import { prisma } from '@modcart/db';

async function check() {
  const products = await prisma.product.findMany({
    include: { images: true }
  });
  console.log(JSON.stringify(products.map(p => ({
    name: p.name,
    imageCount: p.images.length,
    firstImageUrl: p.images[0]?.url
  })), null, 2));
  process.exit(0);
}

check();
