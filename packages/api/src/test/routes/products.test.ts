import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { prisma } from '@modcart/db';
import productRoutes from '../../routes/products';
import { cache } from '../../lib/cache';

const buildApp = async () => {
  const app = Fastify({ logger: false });
  // Need to mock what products.ts expects (authenticate, requireRole etc)
  app.decorate('authenticate', async () => {});
  await app.register(productRoutes);
  return app;
};

describe('GET /products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns products from DB on cache miss and sets cache', async () => {
    const mockProducts = [
      { id: 'p1', name: 'Product 1', status: 'ACTIVE', vendor: { storeName: 'Vendor 1' }, images: [] },
    ];
    vi.mocked(cache.get).mockResolvedValue(null);
    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(cache.get).toHaveBeenCalledWith('products:all');
    expect(prisma.product.findMany).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith('products:all', mockProducts, 300);
  });

  it('returns products from cache on cache hit', async () => {
    const cachedProducts = [
      { id: 'p1', name: 'Product 1 (Cached)' },
    ];
    vi.mocked(cache.get).mockResolvedValue(cachedProducts);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(cachedProducts);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown product slug', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/unknown-product' });

    expect(res.statusCode).toBe(404);
  });
});
