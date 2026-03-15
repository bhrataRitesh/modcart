import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  stockQty: z.number().int().nonnegative(),
  categoryIds: z.array(z.string()).min(1),
});
