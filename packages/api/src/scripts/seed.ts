import { PrismaClient } from '@modcart/db';
import { generateSlug } from '@modcart/core';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with dummy data...');

  // 1. Create Categories
  const catElectronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Gadgets and gear',
      isActive: true,
    },
  });

  const catClothing = await prisma.category.upsert({
    where: { slug: 'clothing' },
    update: {},
    create: {
      name: 'Clothing',
      slug: 'clothing',
      description: 'Apparel and accessories',
      isActive: true,
    },
  });

  // 2. Create a Vendor User
  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@modcart.com' },
    update: {},
    create: {
      email: 'vendor@modcart.com',
      firstName: 'Tech',
      lastName: 'Guru',
      role: 'VENDOR',
      status: 'ACTIVE',
    },
  });

  // 3. Create Vendor Profile
  const vendorProfile = await prisma.vendorProfile.upsert({
    where: { userId: vendorUser.id },
    update: { status: 'ACTIVE' },
    create: {
      userId: vendorUser.id,
      storeName: 'Tech Guru Store',
      storeSlug: 'tech-guru-store',
      description: 'The best tech gadgets around.',
      status: 'ACTIVE',
      commissionRate: 10.0,
    },
  });

  // 4. Create an Admin User
  await prisma.user.upsert({
    where: { email: 'admin@modcart.com' },
    update: {},
    create: {
      email: 'admin@modcart.com',
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // 5. Create some Products
  const productsToCreate = [
    {
      name: 'Pro Wireless Headphones',
      description: 'Noise cancelling overhead headphones.',
      price: 299.99,
      categoryId: catElectronics.id,
      imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=400&auto=format&fit=crop',
    },
    {
      name: 'Minimalist Mechanical Keyboard',
      description: 'Compact wireless mechanical keyboard.',
      price: 149.50,
      categoryId: catElectronics.id,
      imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=400&auto=format&fit=crop',
    },
    {
      name: 'Classic Cotton T-Shirt',
      description: 'Premium everyday essential t-shirt.',
      price: 24.00,
      categoryId: catClothing.id,
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop',
    }
  ];

  for (const p of productsToCreate) {
    const slug = generateSlug(p.name);
    // Create the product
    const product = await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        vendorId: vendorProfile.id,
        name: p.name,
        slug,
        description: p.description,
        price: p.price,
        status: 'ACTIVE',
        trackInventory: true,
        stockQty: 50,
      },
    });

    // Link Category
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: p.categoryId } },
      update: {},
      create: {
        productId: product.id,
        categoryId: p.categoryId,
      },
    });

    // Create a default Variant
    await prisma.productVariant.upsert({
      where: { sku: `${slug}-DEFAULT` },
      update: {},
      create: {
        productId: product.id,
        sku: `${slug}-DEFAULT`,
        price: product.price,
        stockQty: 50,
      },
    });

    // Create an Image (Mocking MinIO URL for now with Unsplash)
    const existingImages = await prisma.productImage.findMany({ where: { productId: product.id } });
    if (existingImages.length === 0) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: p.imageUrl,
          alt: p.name,
          sortOrder: 0,
        }
      });
    }
  }

  console.log('Dummy data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
