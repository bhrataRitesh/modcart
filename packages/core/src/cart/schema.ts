import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const checkoutSchema = z.object({
  shippingAddressId: z.string(),
  billingAddressId: z.string(),
  paymentProvider: z.string(),
  notes: z.string().optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type CheckoutRequest = z.infer<typeof checkoutSchema>;
