import { z } from 'zod';

export const featureTypeSchema = z.enum(['TEXT', 'NUMBER', 'SELECT']);

export const createFeatureSchema = z.object({
  name: z.string().min(1),
  type: featureTypeSchema,
  options: z.array(z.string()).optional(),
  isGlobal: z.boolean().default(false),
  categoryIds: z.array(z.string()).optional(),
});

export const updateFeatureSchema = createFeatureSchema.partial();
