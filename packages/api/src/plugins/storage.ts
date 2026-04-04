import { env } from '@modcart/config';
import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { StorageClient } from '@modcart/core';

export default fp(async (fastify) => {
  // Register multipart support
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

  // Initialize storage client
  const storage = new StorageClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });

  // Decorate fastify instance
  fastify.decorate('storage', storage);
});

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageClient;
  }
}
