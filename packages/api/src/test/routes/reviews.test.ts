import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '@modcart/db';
import reviewRoutes from '../../routes/reviews';

const buildApp = async () => {
  const app = Fastify({ logger: false });

  // Mock authenticate decorator
  app.decorate('authenticate', async (req: any, reply: any) => {
    req.user = { id: 'user-1', role: 'CUSTOMER' };
  });

  await app.register(reviewRoutes);
  return app;
};

describe('Reviews API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('GET /:productId', () => {
    it('returns reviews with stats', async () => {
      const mockReviews = [
        { id: 'r1', productId: 'p1', rating: 5, comment: 'Great!', user: { id: 'u1', firstName: 'John', lastName: 'Doe' }, createdAt: new Date() },
        { id: 'r2', productId: 'p1', rating: 3, comment: 'OK', user: { id: 'u2', firstName: 'Jane', lastName: 'Smith' }, createdAt: new Date() },
      ];
      vi.mocked(prisma.review.findMany).mockResolvedValue(mockReviews as any);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/product-1' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(2);
      expect(body.avgRating).toBe(4);
      expect(body.distribution[5]).toBe(1);
      expect(body.distribution[3]).toBe(1);
    });

    it('returns empty stats for product with no reviews', async () => {
      vi.mocked(prisma.review.findMany).mockResolvedValue([]);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/empty-product' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(0);
      expect(body.avgRating).toBe(0);
    });
  });

  describe('POST /', () => {
    it('rejects duplicate review', async () => {
      vi.mocked(prisma.review.findFirst).mockResolvedValue({ id: 'existing' } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { productId: 'p1', rating: 4, comment: 'Good' },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('already reviewed');
    });

    it('creates review with verified purchase flag', async () => {
      vi.mocked(prisma.review.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.orderItem.findFirst as any).mockResolvedValue({ id: 'oi1' });
      vi.mocked(prisma.review.create).mockResolvedValue({
        id: 'r-new', productId: 'p1', rating: 5, isVerified: true
      } as any);

      const app = await buildApp();
      const res = await app.inject({
        method: 'POST',
        url: '/',
        payload: { productId: 'p1', rating: 5, comment: 'Excellent!' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.isVerified).toBe(true);
    });
  });
});
