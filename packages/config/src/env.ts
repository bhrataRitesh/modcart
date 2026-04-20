import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root, handle both src/ and dist/ paths
const rootPath = __dirname.endsWith('dist') ? '../../../.env' : '../../../../.env';
dotenv.config({ path: path.resolve(__dirname, rootPath) });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  ELASTICSEARCH_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().transform(Number).default('9000'),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  JWT_ACCESS_SECRET: z.string().default('super-secret'),
  STRIPE_SECRET_KEY: z.string().optional(), // Optional for now (mocked)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  SENTRY_DSN: z.string().url().optional(),
  PORT: z.string().transform(Number).default('3001')
});

export const env = envSchema.parse(process.env);
