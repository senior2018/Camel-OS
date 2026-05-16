import { consola } from 'consola'
import { useRedis } from './redis'

// Atomic token-bucket via Lua — executed as a single Redis command
const LUA_TOKEN_BUCKET = `
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now_ms   = tonumber(ARGV[3])
local cost     = tonumber(ARGV[4])

local data   = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts     = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts     = now_ms
end

local elapsed  = math.max(0, (now_ms - ts) / 1000)
local refilled = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if refilled >= cost then
  refilled = refilled - cost
  allowed  = 1
end

local ttl = math.ceil(capacity / rate) + 10
redis.call('HMSET', key, 'tokens', refilled, 'ts', now_ms)
redis.call('EXPIRE', key, ttl)

return { allowed, math.floor(refilled) }
`

export interface RateLimitConfig {
  capacity: number
  refillRate: number // tokens per second
  cost?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number // seconds until 1 token is available (relevant when blocked)
}

// Named profiles used across auth endpoints
export const RATE_LIMITS = {
  login: { capacity: 10, refillRate: 10 / 600 }, // 10 per 10 min per IP
  register: { capacity: 5, refillRate: 5 / 3600 }, // 5 per hour per IP
} as const satisfies Record<string, RateLimitConfig>

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const cost = config.cost ?? 1
  const retryAfter = Math.ceil(cost / config.refillRate)

  try {
    const redis = useRedis()
    const result = (await redis.eval(
      LUA_TOKEN_BUCKET,
      1,
      key,
      String(config.capacity),
      String(config.refillRate),
      String(Date.now()),
      String(cost)
    )) as [number, number]

    return { allowed: result[0] === 1, remaining: result[1], retryAfter }
  } catch (err) {
    // Fail open — log and allow the request if Redis is unavailable
    consola.error('[RateLimit] Redis unavailable, failing open:', (err as Error).message)
    return { allowed: true, remaining: -1, retryAfter }
  }
}
