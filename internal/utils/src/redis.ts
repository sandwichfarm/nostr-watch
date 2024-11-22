export const RedisConnectionDetails = (): Record<string, any> => {
  const redis: Record<string, any> = {};
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('REDIS_')) {
      redis[key.replace('REDIS_', '').toLowerCase()] = process.env[key];
    }
  });
  if (redis?.tls === "true") redis.tls = {};
  return redis;
};
