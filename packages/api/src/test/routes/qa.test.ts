import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '@modcart/db';
import qaRoutes from '../../routes/qa';

const buildApp = async (userRole: string = 'CUSTOMER') => {
  const app = Fastify({ logger: false });
  app.decorate('authenticate', async (req: any) => {
    req.user = { id: 'user-1', role: userRole };
  });
  await app.register(qaRoutes);
  return app;
};

describe('Product Q&A Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/qa/:productId returns public questions', async () => {
    const mockQA = [
      { id: 'qa1', question: 'Does it work?', answer: 'Yes', isPublic: true }
    ];
    vi.mocked(prisma.productQA.findMany).mockResolvedValue(mockQA as any);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/p1' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(mockQA);
    expect(prisma.productQA.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'p1', isPublic: true }
    }));
  });

  it('POST /api/v1/qa asks a new question', async () => {
    const mockQuestion = { id: 'qa2', productId: 'p1', userId: 'user-1', question: 'How is the battery?' };
    vi.mocked(prisma.productQA.create).mockResolvedValue(mockQuestion as any);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { productId: 'p1', question: 'How is the battery?' },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.productQA.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: 'user-1', question: 'How is the battery?' }
    });
  });

  describe('PATCH /:id/answer', () => {
    it('allows a vendor to answer a question', async () => {
      const mockResult = { id: 'qa1', answer: '8 hours' };
      vi.mocked(prisma.productQA.update).mockResolvedValue(mockResult as any);

      const app = await buildApp('VENDOR');
      const res = await app.inject({
        method: 'PATCH',
        url: '/qa1/answer',
        payload: { answer: '8 hours' }
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.productQA.update).toHaveBeenCalledWith({
        where: { id: 'qa1' },
        data: { answer: '8 hours', answeredBy: 'user-1' }
      });
    });

    it('denies a customer from answering a question', async () => {
      const app = await buildApp('CUSTOMER');
      const res = await app.inject({
        method: 'PATCH',
        url: '/qa1/answer',
        payload: { answer: 'hack' }
      });

      expect(res.statusCode).toBe(403);
      expect(prisma.productQA.update).not.toHaveBeenCalled();
    });
  });
});
