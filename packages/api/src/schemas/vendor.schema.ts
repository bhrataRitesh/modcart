import { z } from 'zod';

export const registerVendorSchema = z.object({
  storeName: z.string().min(3).max(100),
  storeSlug: z.string().min(3).max(50),
  description: z.string().optional(),
  businessEmail: z.string().email(),
  businessPhone: z.string().optional(),
  taxId: z.string().optional(),
  kycDocuments: z.record(z.any()).optional(),
});

export const updateVendorStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']),
});
