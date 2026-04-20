import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateCoupon } from '../../services/promotion.service';
import { prisma } from '@modcart/db';

describe('PromotionService.validateCoupon', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const baseCoupon = {
    id: 'c1',
    code: 'SAVE10',
    isActive: true,
    startDate: null,
    endDate: null,
    usageLimit: null,
    usedCount: 0,
    minOrderAmount: 0,
    discountType: 'PERCENTAGE' as const,
    discountValue: 10,
    maxDiscountAmount: null,
  };

  it('applies percentage discount correctly', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue(baseCoupon as any);
    vi.mocked(prisma.order.findFirst as any).mockResolvedValue(null);

    const { discountAmount } = await validateCoupon('SAVE10', 'user-1', 100);
    expect(discountAmount).toBe(10);
  });

  it('throws for expired coupon', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      ...baseCoupon,
      endDate: new Date('2020-01-01'), // in the past
    } as any);

    await expect(validateCoupon('SAVE10', 'user-1', 100)).rejects.toThrow('expired');
  });

  it('throws when usage limit reached', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      ...baseCoupon,
      usageLimit: 5,
      usedCount: 5,
    } as any);

    await expect(validateCoupon('SAVE10', 'user-1', 100)).rejects.toThrow('usage limit');
  });

  it('throws when minimum order not met', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      ...baseCoupon,
      minOrderAmount: 200,
    } as any);

    await expect(validateCoupon('SAVE10', 'user-1', 50)).rejects.toThrow('Minimum order');
  });

  it('caps discount at maxDiscountAmount', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      ...baseCoupon,
      discountValue: 50, // 50%
      maxDiscountAmount: 30, // but max $30
    } as any);
    vi.mocked(prisma.order.findFirst as any).mockResolvedValue(null);

    const { discountAmount } = await validateCoupon('SAVE10', 'user-1', 200);
    expect(discountAmount).toBe(30); // capped at 30
  });

  it('throws for invalid coupon code', async () => {
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);
    await expect(validateCoupon('BOGUS', 'user-1', 100)).rejects.toThrow('Invalid');
  });
});
