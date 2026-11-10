import { randomUUID } from 'node:crypto'

const LUA = [
  "local now = tonumber(ARGV[1])",
  "local window = tonumber(ARGV[2])",
  "local limit = tonumber(ARGV[3])",
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)",
  "local count = redis.call('ZCARD', KEYS[1])",
  "if count >= limit then",
  "  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')",
  "  return {0, count, tonumber(oldest[2]) + window}",
  "end",
  "redis.call('ZADD', KEYS[1], now, ARGV[4])",
  "redis.call('PEXPIRE', KEYS[1], window)",
  "return {1, count + 1, now + window}",
].join('\n')

export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('UPSTASH_RATE_LIMITER_NOT_CONFIGURED')

  const now = Date.now()
  const response = await fetch(url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      'EVAL', LUA, '1',
      'hrih:forge:' + scope + ':' + identifier,
      String(now), String(windowMs), String(limit), randomUUID(),
    ]),
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error('UPSTASH_RATE_LIMITER_UNAVAILABLE')

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !('result' in payload)) {
    throw new Error('UPSTASH_RATE_LIMITER_INVALID_RESPONSE')
  }
  const result = (payload as { result?: unknown }).result
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error('UPSTASH_RATE_LIMITER_INVALID_RESULT')
  }

  const allowed = Number(result[0]) === 1
  const resetAt = Number(result[2])
  if (!Number.isFinite(resetAt)) throw new Error('UPSTASH_RATE_LIMITER_INVALID_RESULT')
  return { allowed, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
}

export function requestIp(request: Request): string {
  return (request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') || 'unknown').trim().slice(0, 80)
}

export function safeSecretEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && require('node:crypto').timingSafeEqual(a, b)
}
