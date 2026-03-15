import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { productSchema, generateSlug } from '@modcart/core';

export default async function productRoutes(fastify: FastifyInstance) {
  // List all active products
  fastify.get('/', async (request) => {
    return prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { vendor: true },
    });
  });

  // Create product (Vendor only)
  fastify.post('/', { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const body = productSchema.parse(request.body);
    const user = request.user as { id: string };

    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) {
      return reply.code(403).send({ message: 'Only vendors can create products' });
    }

    const slug = generateSlug(body.name);

    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        price: body.price,
        stockQty: body.stockQty,
        vendorId: vendor.id,
        status: 'ACTIVE',
        categories: {
          create: body.categoryIds.map((id) => ({
            categoryId: id,
          })),
        },
      },
      include: {
        categories: { include: { category: true } },
      },
    });

    // Background indexing
    import('@modcart/search').then(({ indexProduct }) => {
      indexProduct({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        vendorId: product.vendorId,
        vendorName: vendor.storeName,
        categories: product.categories.map((c: any) => c.category.name),
        imageUrl: product.imageUrl,
      }).catch((err: Error) => fastify.log.error(err, 'Indexing failed'));
    });

    return product;
  });

  // Get single product
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { vendor: true, categories: { include: { category: true } } },
    });

    if (!product) {
      return reply.code(404).send({ message: 'Product not found' });
    }

    return product;
  });
}
