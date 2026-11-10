import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit, requestIp, safeSecretEquals } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export async function POST(request: Request) {
  const expectedKey = process.env.CRM_INTERNAL_API_KEY
  if (!expectedKey) {
    return NextResponse.json({ error: 'Ingestion endpoint is not configured.' }, { status: 503, headers: noStore })
  }

  const authorization = request.headers.get('authorization') || ''
  const providedKey = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || ''
  if (!providedKey || !safeSecretEquals(providedKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized system access.' }, { status: 401, headers: noStore })
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415, headers: noStore })
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 64 * 1024) {
    return NextResponse.json({ error: 'Ingestion payload is too large.' }, { status: 413, headers: noStore })
  }

  const keyFingerprint = createHash('sha256').update(providedKey).digest('hex').slice(0, 24)
  try {
    const [keyLimit, ipLimit] = await Promise.all([
      rateLimit('ingest-key', keyFingerprint, 60, 60_000),
      rateLimit('ingest-ip', requestIp(request), 120, 60_000),
    ])
    if (!keyLimit.allowed || !ipLimit.allowed) {
      const retryAfter = Math.max(keyLimit.retryAfter, ipLimit.retryAfter)
      return NextResponse.json(
        { error: 'Ingestion rate limit exceeded.' },
        { status: 429, headers: { ...noStore, 'Retry-After': String(retryAfter) } },
      )
    }
  } catch {
    // Fail closed: ingestion is paused when the distributed limiter is unavailable.
    return NextResponse.json({ error: 'Ingestion protection is temporarily unavailable.' }, { status: 503, headers: noStore })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400, headers: noStore })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid product payload.' }, { status: 400, headers: noStore })
  }

  const input = body as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const type = typeof input.type === 'string' ? input.type : 'physical'
  const basePrice = typeof input.base_price === 'number' ? input.base_price : Number(input.base_price)
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 4000) : null
  const sourceUrl = typeof input.source_url === 'string' ? input.source_url.trim() : ''

  if (title.length < 3 || title.length > 200) {
    return NextResponse.json({ error: 'Title must contain between 3 and 200 characters.' }, { status: 400, headers: noStore })
  }
  if (!['physical', 'digital', 'service'].includes(type)) {
    return NextResponse.json({ error: 'Unsupported product type.' }, { status: 400, headers: noStore })
  }
  if (!Number.isFinite(basePrice) || basePrice < 0 || basePrice > 100_000_000) {
    return NextResponse.json({ error: 'Base price must be a valid non-negative amount.' }, { status: 400, headers: noStore })
  }

  let canonicalSourceUrl: string
  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid')
    canonicalSourceUrl = parsed.toString()
  } catch {
    return NextResponse.json({ error: 'A valid HTTPS source_url is required.' }, { status: 400, headers: noStore })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hrih_products')
      .insert({
        name: title,
        description,
        category: type,
        unit_price: basePrice,
        billing_type: 'once_off',
        vat_applicable: true,
        active: false,
        source_url: canonicalSourceUrl,
      })
      .select('id,name,category,unit_price,source_url,active,created_at')
      .single()

    if (error?.code === '23505') {
      const existing = await supabase
        .from('hrih_products')
        .select('id,name,category,unit_price,source_url,active,created_at')
        .eq('source_url', canonicalSourceUrl)
        .maybeSingle()

      if (existing.data) {
        return NextResponse.json({ success: true, duplicate: true, product: existing.data }, { status: 200, headers: noStore })
      }
    }

    if (error || !data) {
      console.error('[FORGE ingestion] database write failed:', error?.code || 'UNKNOWN')
      return NextResponse.json({ error: 'Unable to store the product candidate.' }, { status: 500, headers: noStore })
    }

    return NextResponse.json({ success: true, product: data }, { status: 201, headers: noStore })
  } catch (error) {
    console.error('[FORGE ingestion] service failure:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Ingestion service unavailable.' }, { status: 503, headers: noStore })
  }
}
