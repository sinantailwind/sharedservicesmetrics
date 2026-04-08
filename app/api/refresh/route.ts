/**
 * Background refresh endpoint — warms the cache for all time windows.
 * Call this on a schedule (cron, Railway cron, or just on server startup).
 * Protected by a shared secret to prevent unauthorized cache busting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchAgentReport, fetchInactiveAgents, fetchSummaryStats, fetchSessionStats } from '@/lib/queries'
import { setCache } from '@/lib/cache'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

const WINDOWS = [24, 48, 168, 720]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expected = process.env.REFRESH_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  for (const hours of WINDOWS) {
    try {
      const [agents, inactive, summary, sessions] = await Promise.all([
        fetchAgentReport(hours),
        fetchInactiveAgents(hours),
        fetchSummaryStats(hours),
        fetchSessionStats(hours),
      ])
      const payload = { agents, inactive, summary, sessions, aircall: { enabled: false }, hours }
      const ttl = hours <= 48 ? config.cache.ttlSeconds24h : config.cache.ttlSecondsLong
      setCache(`report:${hours}`, payload, ttl)
      results[`${hours}h`] = { agents: agents.length, ok: true }
    } catch (e) {
      results[`${hours}h`] = { ok: false, error: String(e) }
    }
  }

  return NextResponse.json({ refreshed: true, windows: results, at: new Date().toISOString() })
}
