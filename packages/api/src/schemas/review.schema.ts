import { z } from 'zod';

export const createReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});
