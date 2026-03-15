import { FastifyInstance } from 'fastify';
import { prisma } from '@modcart/db';
import { categorySchema, generateSlug } from '@modcart/core';

export default async function categoryRoutes(fastify: FastifyInstance) {
  // List all categories
  fastify.get('/', async () => {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  // Create category (Admin only - simplified role check for now)
  fastify.post('/', async (request, reply) => {
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

    return category;
  });

  // Get single category
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const category = await prisma.category.findUnique({
      where: { slug },
      include: { children: true },
    });

    if (!category) {
      return reply.code(404).send({ message: 'Category not found' });
    }

    return category;
  });
}
