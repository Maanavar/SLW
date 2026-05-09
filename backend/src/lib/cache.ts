import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const TTL_SECONDS = 120;

let redis: Redis | null = null;

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
  redis.connect().catch(() => {
    redis = null;
  });
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, 'EX', TTL_SECONDS);
  } catch {
    // ignore
  }
}

export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${prefix}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // ignore
  }
}
