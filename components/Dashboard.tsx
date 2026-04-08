'use client'
import { useState, useEffect, useCallback } from 'react'
import AgentTable from './AgentTable'
import InactiveAgents from './InactiveAgents'
import AircallPanel from './AircallPanel'
import SessionActivity from './SessionActivity'
import TeamsTagsPanel from './TeamsTagsPanel'
import { TopAgentsChart, ComplexityScatterChart } from './Charts'
import type { AgentStats, InactiveAgent, AgentSessionStats, TeamPerformance, TagStat } from '@/lib/queries'
import clsx from 'clsx'

type Tab = 'leaderboard' | 'inactive' | 'sessions' | 'aircall' | 'teams'

interface ReportData {
  agents: AgentStats[]
  inactive: InactiveAgent[]
  summary: { total_messages: number; active_agents: number; total_conversations: number; avg_reply_length: number }
  sessions: AgentSessionStats[]
  teams: TeamPerformance[]
  tags: TagStat[]
  aircall: {
    enabled: boolean
    error?: string
    agents?: (AgentStats & { aircall: unknown })[]
    transcript_findings?: unknown[]
    summary?: unknown
  }
  hours: number
}

const HOURS_OPTIONS = [
  { label: 'Last 24h', value: 24 },
  { label: 'Last 48h', value: 48 },
  { label: 'Last 7d',  value: 168 },
  { label: 'Last 30d', value: 720 },
]

export default function Dashboard() {
  const [hours, setHours] = useState(24)
  const [tab, setTab]   = useState<Tab>('leaderboard')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchData = useCallback(async (h: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/report?hours=${h}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastRefreshed(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(hours) }, [hours, fetchData])

  const agents = data?.aircall?.agents ?? data?.agents ?? []
  const aircallEnabled = data?.aircall?.enabled ?? false

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center text-sm font-bold">A</div>
            <div>
              <h1 className="font-semibold text-white leading-tight">Agent Performance</h1>
              {lastRefreshed && (
                <p className="text-xs text-gray-500">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {HOURS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setHours(o.value)}
                  className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
                    hours === o.value ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800')}>
                  {o.label}
                </button>
              ))}
            </div>
            <button onClick={() => fetchData(hours)}
              className="btn-ghost text-xs" disabled={loading}>
              {loading ? '⟳ Loading…' : '↺ Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="card border-red-900 text-red-400">
            Failed to load data: {error}
          </div>
        )}

        {/* Summary KPIs */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Messages Sent',  value: data.summary.total_messages.toLocaleString(), sub: `in ${data.hours}h` },
              { label: 'Active Agents',  value: data.summary.active_agents, sub: 'sent ≥1 message' },
              { label: 'Conversations',  value: data.summary.total_conversations.toLocaleString(), sub: 'unique' },
              { label: 'Avg Reply',      value: `${data.summary.avg_reply_length} chars`, sub: 'per message' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="card">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                <p className="text-xs text-gray-600">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts row */}
        {data && data.agents.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Top Agents by Volume</h2>
              <TopAgentsChart agents={data.agents} />
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-1">Volume vs. Reply Depth</h2>
              <p className="text-xs text-gray-600 mb-2">Bubble position = volume × quality. Color = tier.</p>
              <ComplexityScatterChart agents={data.agents} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex gap-1 border-b border-gray-800 mb-4">
            {([
              { id: 'leaderboard', label: `Leaderboard (${data?.agents.length ?? '…'})` },
              { id: 'sessions',    label: `Active Hours` },
              { id: 'inactive',    label: `Inactive (${data?.inactive.length ?? '…'})` },
              { id: 'teams',       label: `Teams & Tags` },
              { id: 'aircall',     label: `Aircall${aircallEnabled ? '' : ' · off'}` },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx('px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  tab === t.id
                    ? 'border-brand-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200')}>
                {t.label}
              </button>
            ))}
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-20 text-gray-500">Loading report…</div>
          )}

          {data && tab === 'leaderboard' && (
            <AgentTable agents={agents as AgentStats[]} showAircall={aircallEnabled} />
          )}

          {data && tab === 'sessions' && (
            <SessionActivity sessions={data.sessions} />
          )}

          {data && tab === 'inactive' && (
            <InactiveAgents agents={data.inactive} />
          )}

          {data && tab === 'teams' && (
            <TeamsTagsPanel
              teams={data.teams ?? []}
              tags={data.tags ?? []}
            />
          )}

          {data && tab === 'aircall' && (
            <AircallPanel
              enabled={aircallEnabled}
              error={data.aircall.error}
              summary={data.aircall.summary as never}
              agents={data.aircall.agents as never}
              transcriptFindings={data.aircall.transcript_findings as never}
            />
          )}
        </div>

        {/* Recommendations */}
        {data && data.agents.length > 0 && tab === 'leaderboard' && (
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Automated Recommendations</h2>
            <ul className="space-y-2 text-sm text-gray-400">
              {(() => {
                const recs: string[] = []
                const top5 = data.agents.slice(0, 5)
                const topName = top5[0]?.agent_name
                if (topName) recs.push(`🏆 ${topName} leads the team — consider using them for training shadowing sessions.`)

                const lowQuality = data.agents.filter(a => a.avg_reply_length_chars < 120 && a.total_messages_sent > 5)
                if (lowQuality.length > 0)
                  recs.push(`⚠️  ${lowQuality.map(a => a.agent_name.split(' ')[0]).join(', ')} averaging under 120 chars/reply — review for reply completeness.`)

                const highBackAndForth = data.agents.filter(a => a.msgs_per_convo > 2.0)
                if (highBackAndForth.length > 0)
                  recs.push(`🔄 ${highBackAndForth.map(a => a.agent_name.split(' ')[0]).join(', ')} have >2 msgs/convo — may indicate first-reply incompleteness.`)

                const underutilized = data.agents.filter(a => a.tier === 'watch' && a.avg_reply_length_chars >= 300)
                if (underutilized.length > 0)
                  recs.push(`📋 ${underutilized.map(a => a.agent_name.split(' ')[0]).join(', ')} write quality replies but handle few conversations — consider increasing their queue volume.`)

                const dormantCount = data.inactive.filter(i => i.status === 'dormant').length
                if (dormantCount > 0)
                  recs.push(`🗑️  ${dormantCount} dormant account${dormantCount > 1 ? 's' : ''} with ACTIVE status — recommend reviewing for deactivation.`)

                const onlineZero = data.inactive.filter(i => i.status === 'zero_this_week')
                if (onlineZero.length > 0)
                  recs.push(`🔴 ${onlineZero.slice(0, 3).map(a => a.agent_name.split(' ')[0]).join(', ')}${onlineZero.length > 3 ? ` +${onlineZero.length - 3} more` : ''} had zero messages this week despite being active — direct follow-up recommended.`)

                return recs.map((r, i) => <li key={i}>{r}</li>)
              })()}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
