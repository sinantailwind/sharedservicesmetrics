import { NextRequest, NextResponse } from 'next/server'
import { fetchAgentReport, fetchInactiveAgents, fetchSummaryStats, fetchSessionStats } from '@/lib/queries'
import { aircallEnabled, fetchAircallUsers, fetchAllCalls, aggregateByAgent, analyzeTranscript } from '@/lib/aircall'
import { getCache, setCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Cache TTL: 60 seconds for 24h window, 5 min for longer windows
function getTTL(hours: number) { return hours <= 48 ? 60 : 300 }

export async function GET(req: NextRequest) {
  const hours = Number(req.nextUrl.searchParams.get('hours') ?? '24')
  if (isNaN(hours) || hours < 1 || hours > 720) {
    return NextResponse.json({ error: 'Invalid hours parameter (1-720)' }, { status: 400 })
  }

  const cacheKey = `report:${hours}`
  const cached = getCache<object>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  try {
    const [agents, inactive, summary, sessions] = await Promise.all([
      fetchAgentReport(hours),
      fetchInactiveAgents(hours),
      fetchSummaryStats(hours),
      fetchSessionStats(hours),
    ])

    let aircallData: Record<string, unknown> | null = null

    if (aircallEnabled()) {
      try {
        const [aircallUsers, calls] = await Promise.all([
          fetchAircallUsers(),
          fetchAllCalls(hours),
        ])

        const byEmail = aggregateByAgent(calls, aircallUsers)

        // Transcript analysis — sample up to 50 answered calls
        const transcriptFindings = calls
          .filter(c => c.transcription?.status === 'done' && c.user?.email)
          .slice(0, 50)
          .map(c => analyzeTranscript(c, c.user!.email))
          .filter(Boolean)

        // Attach Aircall stats to agents
        const agentsWithAircall = agents.map(a => ({
          ...a,
          aircall: byEmail.get(a.email.toLowerCase()) ?? null,
        }))

        aircallData = {
          enabled: true,
          agents: agentsWithAircall,
          transcript_findings: transcriptFindings,
          summary: {
            total_calls: calls.length,
            total_answered: calls.filter(c => c.status === 'done').length,
            total_missed: calls.filter(c => c.status === 'missed').length,
            avg_handle_time_seconds: calls.length > 0
              ? Math.round(calls.reduce((s, c) => s + (c.answered_duration ?? 0), 0) / calls.filter(c => c.answered_duration > 0).length)
              : 0,
          },
        }
      } catch (aircallErr) {
        aircallData = { enabled: true, error: String(aircallErr) }
      }
    } else {
      aircallData = { enabled: false }
    }

    const result = { agents, inactive, summary, sessions, aircall: aircallData, hours }
    setCache(cacheKey, result, getTTL(hours))
    return NextResponse.json({ ...result, cached: false })
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
