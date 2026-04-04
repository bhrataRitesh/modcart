import { prisma } from '@modcart/db';

export const validateCoupon = async (code: string, userId: string, subtotal: number) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code, isActive: true },
  });

  if (!coupon) {
    throw new Error('Invalid or expired coupon code');
  }

  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) throw new Error('Coupon not yet active');
  if (coupon.endDate && now > coupon.endDate) throw new Error('Coupon expired');

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }

  if (subtotal < coupon.minOrderAmount) {
    throw new Error(`Minimum order amount of $${coupon.minOrderAmount} required`);
  }

  // Check if user has already used this coupon (optional, usually coupons are one-time)
  const previousUsage = await prisma.order.findFirst({
    where: { userId, couponId: coupon.id, paymentStatus: 'PAID' }
  });

  if (previousUsage) throw new Error('You have already used this coupon');

  let discountAmount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  return { coupon, discountAmount };
};

export const getActiveFlashSales = async () => {
  const now = new Date();
  return prisma.flashSale.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      product: {
        include: { images: { take: 1 }, vendor: true }
      }
    }
  });
};
