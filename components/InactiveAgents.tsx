'use client'
import { useState } from 'react'
import type { InactiveAgent } from '@/lib/queries'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'

const STATUS_CONFIG = {
  absent_today:  { label: 'Absent Today',  dot: 'bg-amber-400',  row: '' },
  zero_this_week:{ label: 'No Activity',   dot: 'bg-red-400',    row: 'bg-red-950/20' },
  dormant:       { label: 'Dormant',       dot: 'bg-gray-500',   row: 'bg-gray-900/50' },
}

export default function InactiveAgents({ agents }: { agents: InactiveAgent[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? agents : agents.filter(a => a.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'zero_this_week', 'absent_today', 'dormant'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('btn capitalize text-xs', filter === f ? 'btn-primary' : 'btn-ghost')}>
            {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
            <span className="ml-1 opacity-60">
              ({f === 'all' ? agents.length : agents.filter(a => a.status === f).length})
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="table-header">Agent</th>
              <th className="table-header">Team</th>
              <th className="table-header">Status</th>
              <th className="table-header">Last Seen</th>
              <th className="table-header">7-Day Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filtered.map(a => {
              const { label, dot, row } = STATUS_CONFIG[a.status]
              return (
                <tr key={a.agent_id} className={clsx('hover:bg-gray-800/30 transition-colors', row)}>
                  <td className="table-cell">
                    <div className="font-medium text-gray-200">{a.agent_name}</div>
                    <div className="text-xs text-gray-500">{a.email}</div>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">{a.team_name ?? '—'}</td>
                  <td className="table-cell">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={clsx('h-2 w-2 rounded-full', dot)} />
                      {label}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">
                    {a.last_seen_at
                      ? formatDistanceToNow(new Date(a.last_seen_at), { addSuffix: true })
                      : 'Never'}
                  </td>
                  <td className="table-cell font-mono">
                    <span className={clsx(a.msgs_last_7d === 0 ? 'text-red-400' : 'text-amber-400')}>
                      {a.msgs_last_7d}
                    </span>
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
