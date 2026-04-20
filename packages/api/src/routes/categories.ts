import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { categorySchema, generateSlug } from '@modcart/core';
import { cache } from '../lib/cache';
import { requirePermission } from '../middleware/rbac';

export default async function categoryRoutes(fastify: FastifyInstance) {
  // List all categories (cached 10 minutes — rarely changes)
  fastify.get('/', async () => {
    const CACHE_KEY = 'categories:all';
    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    await cache.set(CACHE_KEY, categories, 600);
    return categories;
  });

  // Create category (Admin only)
  fastify.post('/', { preHandler: [fastify.authenticate, requirePermission('manage_categories')] }, async (request, reply) => {
    const body = categorySchema.parse(request.body);
    const slug = generateSlug(body.name);

    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        parentId: body.parentId,
      },
    });

    // Invalidate cache
    await cache.del('categories:all');
    return category;
  });

  // Get single category (cached 10 minutes)
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const CACHE_KEY = `categories:${slug}`;

    const cached = await cache.get(CACHE_KEY);
    if (cached) return cached;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: { children: true },
    });

    if (!category) {
      return reply.code(404).send({ message: 'Category not found' });
    }

    await cache.set(CACHE_KEY, category, 600);
    return category;
  });

  // Delete category (Admin only)
  fastify.delete('/:id', { preHandler: [fastify.authenticate, requirePermission('manage_categories')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Deleting a category should cascade or block depending on DB settings.
    // Our schema isn't fully cascaded for products, but we will delete for now.
    await prisma.category.delete({ where: { id } });
    await cache.del('categories:all');
    
    return { success: true, message: 'Category deleted successfully' };
  });
}
