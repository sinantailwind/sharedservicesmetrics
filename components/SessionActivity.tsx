'use client'
import { useState, useMemo } from 'react'
import type { AgentSessionStats } from '@/lib/queries'
import clsx from 'clsx'

function fmtMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function SessionActivity({ sessions }: { sessions: AgentSessionStats[] }) {
  const [sort, setSort] = useState<'msgs_per_active_hour' | 'total_messages' | 'active_window_minutes'>('msgs_per_active_hour')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')

  const sorted = useMemo(() =>
    [...sessions].sort((a, b) => dir === 'desc' ? b[sort] - a[sort] : a[sort] - b[sort]),
    [sessions, sort, dir]
  )

  function handleSort(k: typeof sort) {
    if (k === sort) setDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(k); setDir('desc') }
  }

  function SortTh({ k, children }: { k: typeof sort; children: React.ReactNode }) {
    const active = k === sort
    return (
      <th className={clsx('table-header cursor-pointer select-none hover:text-gray-200', active && 'text-white')}
          onClick={() => handleSort(k)}>
        <span className="inline-flex items-center gap-1">
          {children}
          {active && <span className="text-brand-500">{dir === 'desc' ? '↓' : '↑'}</span>}
        </span>
      </th>
    )
  }

  const maxRate = Math.max(...sessions.map(s => s.msgs_per_active_hour), 1)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Active window is derived from <code className="bg-gray-800 px-1 rounded text-amber-400">auth_sessions</code> — the span between first login and last activity in the window.
        {' '}<span className="text-amber-400">Msgs/hr</span> = messages sent ÷ active hours logged in. Agents absent from sessions were not tracked by the platform during this window.
      </p>
      <p className="text-xs text-amber-600/80 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
        Note: active window = last_session_activity − first_login. It overestimates time if the agent was idle mid-session, and underestimates it if they had multiple separate shifts. For precise shift-level tracking, a dedicated scheduling system (e.g. hub staff DB) would be needed.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="table-header w-6 text-center">#</th>
              <th className="table-header">Agent</th>
              <th className="table-header">Sessions</th>
              <SortTh k="active_window_minutes">Active Window</SortTh>
              <SortTh k="total_messages">Messages</SortTh>
              <SortTh k="msgs_per_active_hour">Msgs / Active Hour</SortTh>
              <th className="table-header">Login → Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {sorted.map((s, i) => {
              const barWidth = maxRate > 0 ? (s.msgs_per_active_hour / maxRate) * 100 : 0
              const isLow = s.msgs_per_active_hour < 5 && s.active_window_minutes > 30
              return (
                <tr key={s.agent_id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="table-cell text-center text-gray-500 text-xs">{i + 1}</td>
                  <td className="table-cell">
                    <div className="font-medium text-gray-100">{s.agent_name}</div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </td>
                  <td className="table-cell font-mono text-xs">{s.session_count}</td>
                  <td className="table-cell font-mono text-xs">
                    {s.active_window_minutes > 0 ? fmtMinutes(s.active_window_minutes) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="table-cell font-mono">{s.total_messages}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-gray-700 w-20 overflow-hidden">
                        <div className={clsx('h-full rounded-full', isLow ? 'bg-red-500' : 'bg-brand-500')}
                             style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className={clsx('font-mono text-xs', isLow && 'text-red-400')}>
                        {s.msgs_per_active_hour > 0 ? s.msgs_per_active_hour : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-xs text-gray-500">
                    {s.first_seen
                      ? `${new Date(s.first_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${s.last_seen ? new Date(s.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'}`
                      : <span className="text-gray-600">No session data</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
