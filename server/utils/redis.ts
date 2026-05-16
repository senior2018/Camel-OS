import Redis from 'ioredis'
import { consola } from 'consola'

let _client: Redis | null = null
let _isDown = false

export function useRedis(): Redis {
  if (_client) return _client

  const url = (useRuntimeConfig().redisUrl as string) || process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL is not configured')

  _client = new Redis(url, {
    maxRetriesPerRequest: 0,  // fail commands immediately when offline — rate limiter fails open
    enableOfflineQueue: false, // don't queue commands while disconnected
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(500 * times, 30_000), // backoff up to 30s, keep retrying
  })

  _client.on('error', (err: Error) => {
    if (!_isDown) {
      consola.warn('[Redis] Connection lost:', err.message)
      _isDown = true
    }
  })

  _client.on('ready', () => {
    if (_isDown) {
      consola.info('[Redis] Reconnected')
      _isDown = false
    }
  })

  return _client
}
