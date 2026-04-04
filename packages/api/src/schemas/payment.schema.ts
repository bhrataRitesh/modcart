import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  orderId: z.string().cuid()
});

export const checkoutPaymentSchema = z.object({
  shippingAddressId: z.string().cuid().optional(),
  billingAddressId: z.string().cuid().optional(),
  notes: z.string().optional()
});
