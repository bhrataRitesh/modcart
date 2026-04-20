import { z } from 'zod';

export const productStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const productTypeSchema = z.enum(['PHYSICAL', 'DIGITAL', 'CONFIGURABLE']);

export const productOptionSchema = z.object({
  name: z.string(),
  type: z.enum(['SELECT', 'RADIO', 'CHECKBOX', 'TEXT', 'FILE']),
  required: z.boolean().default(false),
  values: z.array(z.object({
    name: z.string(),
    priceMod: z.number().optional()
  }))
});

export const productVariantSchema = z.object({
  sku: z.string(),
  price: z.number().nonnegative(),
  stockQty: z.number().int().nonnegative(),
  imageId: z.string().optional()
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  shortDesc: z.string().optional(),
  status: productStatusSchema.default('DRAFT'),
  type: productTypeSchema.default('PHYSICAL'),
  price: z.number().nonnegative(),
  comparePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.number().nonnegative().optional(),
  trackInventory: z.boolean().default(true),
  stockQty: z.number().int().nonnegative().default(0),
  lowStockAlert: z.number().int().nonnegative().default(5),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  vendorId: z.string().optional(), // Can be optional if taken from user session
  categoryIds: z.array(z.string()).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().default(0)
  })).optional(),
  options: z.array(productOptionSchema).optional(),
  variants: z.array(productVariantSchema).optional(),
  featureValues: z.array(z.object({
    featureId: z.string(),
    value: z.string()
  })).optional()
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().cuid()
});
