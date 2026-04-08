'use client'
import { formatDuration } from '@/lib/aircall'
import clsx from 'clsx'

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
  transcriptFindings?: TranscriptFinding[]
}

export default function AircallPanel({ enabled, error, summary, transcriptFindings }: Props) {
  if (!enabled) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center text-xl">📞</div>
        <p className="font-semibold text-gray-300">Aircall not connected</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Set <code className="bg-gray-800 px-1 rounded text-amber-400">AIRCALL_API_ID</code> and{' '}
          <code className="bg-gray-800 px-1 rounded text-amber-400">AIRCALL_API_TOKEN</code> in your environment
          variables to activate call analytics and transcript analysis.
        </p>
        <div className="text-xs text-gray-600 mt-2">
          Get your API credentials from{' '}
          <span className="text-brand-500">Aircall Dashboard → Integrations → API Keys</span>
        </div>
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

  const issues = (transcriptFindings ?? []).filter(f => f.findings.length > 0)
  const findingCounts = new Map<string, number>()
  for (const tf of issues) {
    for (const f of tf.findings) {
      findingCounts.set(f, (findingCounts.get(f) ?? 0) + 1)
    }
  }
  const sortedFindings = Array.from(findingCounts.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Calls', value: summary.total_calls },
            { label: 'Answered', value: summary.total_answered },
            { label: 'Missed', value: summary.total_missed },
            { label: 'Avg AHT', value: formatDuration(summary.avg_handle_time_seconds) },
          ].map(({ label, value }) => (
            <div key={label} className="card text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AHT improvement findings */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-100">
          Transcript Analysis — AHT Improvement Opportunities
        </h3>
        {issues.length === 0 ? (
          <p className="text-sm text-gray-500">
            {(transcriptFindings ?? []).length === 0
              ? 'No transcripts available. Enable transcription in Aircall to activate this analysis.'
              : 'No issues detected in analyzed transcripts.'}
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Analyzed {transcriptFindings?.length ?? 0} calls. {issues.length} had improvement signals.
            </p>

            {/* Top patterns */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Most Common Issues</p>
              {sortedFindings.map(([finding, count]) => (
                <div key={finding} className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
                  <span className="shrink-0 text-xs font-mono bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                    {count}x
                  </span>
                  <p className="text-sm text-gray-300">{finding}</p>
                </div>
              ))}
            </div>

            {/* Per-call breakdown */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-brand-500 hover:text-brand-400 select-none">
                Show per-call breakdown ({issues.length} calls)
              </summary>
              <div className="mt-3 space-y-2">
                {issues.slice(0, 20).map(tf => (
                  <div key={tf.callId}
                       className={clsx('rounded-lg p-3 border text-xs',
                         tf.score >= 80 ? 'border-gray-700 bg-gray-800/30' :
                         tf.score >= 60 ? 'border-amber-900/50 bg-amber-950/20' :
                         'border-red-900/50 bg-red-950/20')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-300">{tf.agentEmail}</span>
                      <span className="text-gray-500">Call #{tf.callId} · {formatDuration(tf.durationSeconds)}</span>
                    </div>
                    <ul className="space-y-0.5 text-gray-400">
                      {tf.findings.map((f, i) => <li key={i}>• {f}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
