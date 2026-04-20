import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { generateSlug } from '@modcart/core';
import { validate } from '../middleware/validate';
import { cache } from '../lib/cache';
import { sendNotification } from '../services/notification.service';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { requireRole, requireOwnership } from '../middleware/rbac';
import { UserPayload } from '../types';
import { z } from 'zod';

type CreateProductBody = z.infer<typeof createProductSchema>;
type UpdateProductBody = z.infer<typeof updateProductSchema>;

export default async function productRoutes(fastify: FastifyInstance) {
  // List all active products (cached 5 minutes)
  fastify.get('/', async () => {
    const CACHE_KEY = 'products:all';
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;

    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { 
        vendor: true, 
        images: { take: 1 } 
      },
    });

    await cache.set(CACHE_KEY, products, 300);
    return products;
  });

  // Create product (Vendor only)
  fastify.post('/', { preHandler: [fastify.authenticate, requireRole(['VENDOR']), validate(createProductSchema)] }, async (request, reply) => {
    const body = request.body as CreateProductBody;
    const user = request.user as UserPayload;

    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: user.id },
      include: { plan: true, _count: { select: { products: true } } }
    });

    if (!vendor) {
      return reply.code(403).send({ message: 'Only vendors can create products' });
    }

    if (vendor.plan && vendor._count.products >= vendor.plan.maxProducts) {
      return reply.code(403).send({ message: `Plan limit reached. Your current plan allows up to ${vendor.plan.maxProducts} products.` });
    }

    const slug = body.slug || generateSlug(body.name);
    // Products start as DRAFT so they can be approved by admin (moderation queue)
    const status = body.status || 'DRAFT';

    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        price: body.price,
        stockQty: body.stockQty,
        vendorId: vendor.id,
        status: status,
        categories: body.categoryIds ? {
          create: body.categoryIds.map((id: string) => ({
            categoryId: id,
          })),
        } : undefined,
        images: body.images ? {
          create: body.images.map(img => ({ url: img.url, alt: img.alt, sortOrder: img.sortOrder }))
        } : undefined,
        options: body.options ? {
          create: body.options.map(opt => ({
            name: opt.name,
            type: opt.type,
            required: opt.required,
            values: {
              create: opt.values.map(val => ({
                name: val.name,
                priceMod: val.priceMod
              }))
            }
          }))
        } : undefined,
        variants: body.variants ? {
          create: body.variants.map(v => ({
            sku: v.sku,
            price: v.price,
            stockQty: v.stockQty,
            imageId: v.imageId
          }))
        } : undefined
      },
      include: {
        categories: { include: { category: true } },
        images: true,
        options: { include: { values: true } },
        variants: true
      },
    });

    // Background indexing
    import('@modcart/search').then(({ indexProduct }) => {
      indexProduct({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: Number(product.price),
        vendorId: product.vendorId,
        vendorName: vendor.storeName,
        categories: product.categories.map((c: any) => c.category.name),
        imageUrl: product.images[0]?.url || '',
        imageUrls: product.images.map(img => img.url),
        isVerified: true
      }).catch((err: Error) => fastify.log.error(err, 'Indexing failed'));
    });
 
    await cache.del('products:all');
    return product;
  });

  // Get single product
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { vendor: true, categories: { include: { category: true } }, images: true },
    });

    if (!product) {
      return reply.code(404).send({ message: 'Product not found' });
    }

    return product;
  });

  // Update product (Vendor only)
  fastify.put('/:id', { preHandler: [fastify.authenticate, requireRole(['VENDOR']), requireOwnership('product'), validate(updateProductSchema)] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateProductBody;
    const user = request.user as UserPayload;

    const oldProduct = await prisma.product.findUnique({ where: { id }, select: { price: true, name: true } });

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        stockQty: body.stockQty,
        images: body.images ? {
          deleteMany: {},
          create: body.images.map(img => ({ url: img.url, alt: img.alt, sortOrder: img.sortOrder }))
        } : undefined,
        categories: body.categoryIds ? {
          deleteMany: {},
          create: body.categoryIds.map((cid: string) => ({ categoryId: cid }))
        } : undefined
      },
      include: { images: true }
    });

    // Price Drop Notification Trigger
    if (oldProduct && body.price && body.price < oldProduct.price) {
      setImmediate(async () => {
        try {
          const wishlistedUsers = await prisma.wishlistItem.findMany({
            where: { productId: id },
            select: { userId: true }
          });

          for (const item of wishlistedUsers) {
            await sendNotification({
              userId: item.userId,
              type: 'PRICE_DROP',
              title: 'Price Drop Alert! 📉',
              message: `A product in your wishlist "${oldProduct.name}" just dropped in price to $${body.price}!`,
              link: `/products/${id}` // Or use slug if available
            });
          }
        } catch (err) {
          fastify.log.error(err, 'Failed to trigger price drop notifications');
        }
      });
    }
 
    await cache.del('products:all');
    return updated;
  });

  // Manual Stock Adjustment
  fastify.post('/:id/stock', { preHandler: [fastify.authenticate, requireRole(['VENDOR']), requireOwnership('product')] }, async (request) => {
    const { id } = request.params as { id: string };
    const { variantId, change, reason } = request.body as { variantId?: string, change: number, reason: string };

    const { adjustStock } = await import('../services/inventory.service');
    await adjustStock({
      productId: id,
      variantId,
      change,
      reason: reason as any || 'MANUAL_ADJUSTMENT'
    });

    return { message: 'Stock adjusted' };
  });

  // Stock History
  fastify.get('/:id/stock-history', { preHandler: [fastify.authenticate, requireRole(['VENDOR', 'ADMIN']), requireOwnership('product')] }, async (request) => {
    const { id } = request.params as { id: string };
    return prisma.stockEvent.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      include: { variant: true }
    });
  });
}
