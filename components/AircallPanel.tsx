'use client'
import { formatDuration } from '@/lib/aircall'
import clsx from 'clsx'

interface AircallStats {
  total_calls: number
  answered_calls: number
  missed_calls: number
  inbound_calls: number
  outbound_calls: number
  pickup_rate: number
  missed_call_rate: number
  total_talk_time_seconds: number
  avg_handle_time_seconds: number
  longest_call_seconds: number
  shortest_call_seconds: number
  avg_wait_time_seconds: number
}

interface AgentWithAircall {
  agent_id: number
  agent_name: string
  email: string
  aircall: AircallStats | null
}

interface TranscriptFinding {
  agentEmail: string
  callId: number
  durationSeconds: number
  findings: string[]
  score: number
}

interface AircallSummary {
  total_calls: number
  total_answered: number
  total_missed: number
  avg_handle_time_seconds: number
}

interface Props {
  enabled: boolean
  error?: string
  summary?: AircallSummary
  agents?: AgentWithAircall[]
  transcriptFindings?: TranscriptFinding[]
}

function RateBar({ value, danger }: { value: number; danger?: boolean }) {
  const color = danger
    ? value > 30 ? 'bg-red-500' : value > 15 ? 'bg-amber-500' : 'bg-emerald-500'
    : value >= 90 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-gray-700 overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs">{value}%</span>
    </div>
  )
}

export default function AircallPanel({ enabled, error, summary, agents, transcriptFindings }: Props) {
  if (!enabled) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center text-xl">📞</div>
        <p className="font-semibold text-gray-300">Aircall not connected</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Set <code className="bg-gray-800 px-1 rounded text-amber-400">AIRCALL_API_ID</code> and{' '}
          <code className="bg-gray-800 px-1 rounded text-amber-400">AIRCALL_API_TOKEN</code> in your environment variables.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-red-900">
        <p className="text-red-400 font-medium">Aircall API Error</p>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
      </div>
    )
  }

  const agentsWithCalls = (agents ?? []).filter(a => a.aircall && a.aircall.total_calls > 0)
    .sort((a, b) => (b.aircall?.total_calls ?? 0) - (a.aircall?.total_calls ?? 0))

  const issues = (transcriptFindings ?? []).filter(f => f.findings.length > 0)
  const findingCounts = new Map<string, number>()
  for (const tf of issues) {
    for (const f of tf.findings) findingCounts.set(f, (findingCounts.get(f) ?? 0) + 1)
  }
  const sortedFindings = Array.from(findingCounts.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Calls',   value: summary.total_calls },
            { label: 'Answered',      value: summary.total_answered },
            { label: 'Missed',        value: summary.total_missed },
            { label: 'Avg AHT',       value: formatDuration(summary.avg_handle_time_seconds) },
          ].map(({ label, value }) => (
            <div key={label} className="card text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-agent call table */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-100">Per-Agent Call Performance</h3>
        {agentsWithCalls.length === 0 ? (
          <p className="text-sm text-gray-500">No call data found for this time window.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="table-header">Agent</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">In / Out</th>
                  <th className="table-header">Pickup Rate</th>
                  <th className="table-header">Missed Rate</th>
                  <th className="table-header">Avg AHT</th>
                  <th className="table-header">Longest</th>
                  <th className="table-header">Talk Time</th>
                  <th className="table-header">Avg Wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {agentsWithCalls.map(a => {
                  const s = a.aircall!
                  return (
                    <tr key={a.agent_id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="table-cell">
                        <div className="font-medium text-gray-100">{a.agent_name}</div>
                        <div className="text-xs text-gray-500">{a.email}</div>
                      </td>
                      <td className="table-cell font-mono font-semibold">{s.total_calls}</td>
                      <td className="table-cell font-mono text-xs text-gray-400">
                        {s.inbound_calls}↓ / {s.outbound_calls}↑
                      </td>
                      <td className="table-cell"><RateBar value={s.pickup_rate} /></td>
                      <td className="table-cell"><RateBar value={s.missed_call_rate} danger /></td>
                      <td className="table-cell font-mono text-xs">
                        {s.avg_handle_time_seconds > 0 ? formatDuration(s.avg_handle_time_seconds) : '—'}
                      </td>
                      <td className="table-cell font-mono text-xs text-gray-400">
                        {s.longest_call_seconds > 0 ? formatDuration(s.longest_call_seconds) : '—'}
                      </td>
                      <td className="table-cell font-mono text-xs">
                        {formatDuration(s.total_talk_time_seconds)}
                      </td>
                      <td className="table-cell font-mono text-xs text-gray-400">
                        {s.avg_wait_time_seconds > 0 ? formatDuration(s.avg_wait_time_seconds) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AHT transcript findings */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-100">Transcript Analysis — AHT Improvement Opportunities</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-gray-500">
            {(transcriptFindings ?? []).length === 0
              ? 'No transcripts available. Enable transcription in Aircall to activate this analysis.'
              : 'No issues detected in analyzed transcripts.'}
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">Analyzed {transcriptFindings?.length ?? 0} calls. {issues.length} had signals.</p>
            <div className="space-y-2">
              {sortedFindings.map(([finding, count]) => (
                <div key={finding} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
                  <span className="shrink-0 text-xs font-mono bg-red-900/30 text-red-400 px-2 py-0.5 rounded">{count}x</span>
                  <p className="text-sm text-gray-300">{finding}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
