import { NextRequest, NextResponse } from 'next/server'
import { fetchAgentReport, fetchInactiveAgents, fetchSummaryStats, fetchSessionStats, fetchTeamPerformance, fetchTagBreakdown } from '@/lib/queries'
import { aircallEnabled, fetchAircallUsers, fetchAllCalls, aggregateByAgent, analyzeTranscript } from '@/lib/aircall'
import { getCache, setCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

function getTTL(hours: number) { return hours <= 48 ? 60 : 300 }

async function getAircallData(hours: number, agents: Awaited<ReturnType<typeof fetchAgentReport>>) {
  if (!aircallEnabled()) return { enabled: false }
  try {
    const [aircallUsers, calls] = await Promise.all([
      fetchAircallUsers(),
      fetchAllCalls(hours),
    ])
    const byEmail = aggregateByAgent(calls, aircallUsers)
    const transcriptFindings = calls
      .filter(c => c.transcription?.status === 'done' && c.user?.email)
      .slice(0, 50)
      .map(c => analyzeTranscript(c, c.user!.email))
      .filter(Boolean)
    const agentsWithAircall = agents.map(a => ({
      ...a,
      aircall: byEmail.get(a.email.toLowerCase()) ?? null,
    }))
    return {
      enabled: true,
      agents: agentsWithAircall,
      transcript_findings: transcriptFindings,
      summary: {
        total_calls: calls.length,
        total_answered: calls.filter(c => c.status === 'done').length,
        total_missed: calls.filter(c => c.status === 'missed').length,
        avg_handle_time_seconds: calls.filter(c => c.answered_duration > 0).length > 0
          ? Math.round(calls.reduce((s, c) => s + (c.answered_duration ?? 0), 0) / calls.filter(c => c.answered_duration > 0).length)
          : 0,
      },
    }
  } catch (e) {
    return { enabled: true, error: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const hours = Number(req.nextUrl.searchParams.get('hours') ?? '24')
  if (isNaN(hours) || hours < 1 || hours > 720) {
    return NextResponse.json({ error: 'Invalid hours parameter (1-720)' }, { status: 400 })
  }

  try {
    // DB data: served from cache if available, otherwise fetch and cache
    const dbCacheKey = `report:db:${hours}`
    let dbData = getCache<{ agents: unknown; inactive: unknown; summary: unknown; sessions: unknown; teams: unknown; tags: unknown }>(dbCacheKey)
    let cached = true

    if (!dbData) {
      cached = false
      const [agents, inactive, summary, sessions, teams, tags] = await Promise.all([
        fetchAgentReport(hours),
        fetchInactiveAgents(hours),
        fetchSummaryStats(hours),
        fetchSessionStats(hours),
        fetchTeamPerformance(hours),
        fetchTagBreakdown(hours),
      ])
      dbData = { agents, inactive, summary, sessions, teams, tags }
      setCache(dbCacheKey, dbData, getTTL(hours))
    }

    // Aircall: always fetched live (fast external API, not the slow DB)
    const aircall = await getAircallData(hours, dbData.agents as Awaited<ReturnType<typeof fetchAgentReport>>)

    return NextResponse.json({ ...dbData, aircall, hours, cached })
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
