import { prisma } from '@modcart/db';
import { cache } from '../lib/cache';

export const getSimilarProducts = async (productId: string, limit = 4) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { categories: true },
  });

  if (!product) return [];

  const categoryIds = product.categories.map((c) => c.categoryId);

  return prisma.product.findMany({
    where: {
      id: { not: productId },
      status: 'ACTIVE',
      categories: {
        some: {
          categoryId: { in: categoryIds },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { images: true, vendor: true },
  });
};

export const getAlsoBought = async (productId: string, limit = 4) => {
  // Find orders containing this product
  const ordersWithProduct = await prisma.orderItem.findMany({
    where: { productId },
    select: { orderId: true },
  });

  const orderIds = ordersWithProduct.map((o) => o.orderId);

  // Find other products in those orders
  const otherProducts = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      orderId: { in: orderIds },
      productId: { not: productId },
    },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  const productIds = otherProducts.map((p) => p.productId);

  return prisma.product.findMany({
    where: { id: { in: productIds }, status: 'ACTIVE' },
    include: { images: true, vendor: true },
  });
};

export const getTrendingProducts = async (limit = 8) => {
  const CACHE_KEY = `recommendations:trending:${limit}`;
  const cached = await cache.get(CACHE_KEY);
  if (cached) return cached;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const topVisits = await prisma.pageVisit.groupBy({
    by: ['productId'],
    where: {
      productId: { not: null },
      createdAt: { gte: sevenDaysAgo },
    },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  const productIds = topVisits.map((v) => v.productId as string);

  return prisma.product.findMany({
    where: { id: { in: productIds }, status: 'ACTIVE' },
    include: { images: true, vendor: true },
  });
};

export const getRecentlyViewed = async (visitorId: string, limit = 8) => {
  const recentVisits = await prisma.pageVisit.findMany({
    where: { visitorId, productId: { not: null } },
    orderBy: { createdAt: 'desc' },
    distinct: ['productId'],
    take: limit,
    include: {
      product: {
        include: { images: true, vendor: true },
      },
    },
  });

  return recentVisits.map((v) => v.product).filter(Boolean);
};
