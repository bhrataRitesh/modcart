import { z } from 'zod';

export const orderStatusSchema = z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']);

export const createOrderSchema = z.object({
  guestEmail: z.string().email().optional(),
  shippingAddressId: z.string().cuid().optional(),
  billingAddressId: z.string().cuid().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid().optional(),
    quantity: z.number().int().positive()
  })).min(1)
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema
});
