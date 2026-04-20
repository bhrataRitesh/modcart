import { z } from 'zod';

export const orderStatusSchema = z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']);

export const createOrderSchema = z.object({
  guestEmail: z.string().email().optional(),
  shippingAddressId: z.string().cuid(),
  billingAddressId: z.string().cuid().optional(),
  shippingMethodId: z.string().cuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive()
  })).min(1).optional() // items comes from cart mostly, but allowing optional
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema
});
