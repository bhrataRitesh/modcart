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
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  // Decorate fastify instance
  fastify.decorate('storage', storage);
});

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageClient;
  }
}
