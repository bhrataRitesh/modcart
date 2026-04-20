import { vi } from 'vitest';

// Mock Prisma globally so tests don't need a real DB
vi.mock('@modcart/db', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    coupon: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    flashSale: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    productQA: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    wishlistItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    pageVisit: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock Redis cache so tests run without Redis
vi.mock('../lib/cache', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));
