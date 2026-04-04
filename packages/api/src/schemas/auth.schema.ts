import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const updateMeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional()
});

export const addressSchema = z.object({
  label: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2), // Assuming ISO 3166-1 alpha-2
  isDefault: z.boolean().default(false)
});
