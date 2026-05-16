import Redis from 'ioredis'
import { consola } from 'consola'

let _client: Redis | null = null

export function useRedis(): Redis {
  if (_client) return _client

  const url = (useRuntimeConfig().redisUrl as string) || process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL is not configured')

  _client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
  _client.on('error', (err: Error) => consola.error('[Redis]', err.message))

  return _client
}
