import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export const getRedis = async () => {
  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
};

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await getRedis();
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null; // Cache miss is not fatal
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Cache write failure is not fatal
    }
  },

  async del(key: string): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(key);
    } catch {
      // Ignore cache delete failure
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      const redis = await getRedis();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch {
      // Ignore
    }
  }
};
