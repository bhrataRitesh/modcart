import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '@modcart/db';
import categoryRoutes from '../../routes/categories';
import { cache } from '../../lib/cache';

const buildApp = async (permissions: string[] = []) => {
  const app = Fastify({ logger: false });
  app.decorate('authenticate', async () => {});
  app.decorate('requirePermission', (perm: string) => async (req: any, reply: any) => {
    if (!permissions.includes(perm)) {
      return reply.code(403).send({ message: 'Forbidden' });
    }
  });
  await app.register(categoryRoutes);
  return app;
};

describe('Category Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns a list of categories', async () => {
      const mockCategories = [{ id: 'cat1', name: 'Electronics', isActive: true }];
      vi.mocked(cache.get).mockResolvedValue(null);
      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as any);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/' });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual(mockCategories);
    });
  });

  describe('POST /', () => {
    it('allows admin with permission to create category', async () => {
      const mockCategory = { id: 'new-cat', name: 'New Category' };
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory as any);

      const app = await buildApp(['manage_categories']);
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'New Category' }
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.category.create).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('categories:all');
    });

    it('denies user without permission', async () => {
      const app = await buildApp([]);
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'Unauthorized' }
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /:id', () => {
    it('allows deletion and invalidates cache', async () => {
      const app = await buildApp(['manage_categories']);
      const res = await app.inject({
        method: 'DELETE',
        url: '/cat-id'
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-id' } });
      expect(cache.del).toHaveBeenCalledWith('categories:all');
    });
  });
});
