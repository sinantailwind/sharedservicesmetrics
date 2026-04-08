'use client'
import { useState, useMemo } from 'react'
import TierBadge from './TierBadge'
import { formatDuration } from '@/lib/aircall'
import type { AgentStats } from '@/lib/queries'
import clsx from 'clsx'

type SortKey = 'total_messages_sent' | 'adjusted_score' | 'unique_conversations' |
               'avg_reply_length_chars' | 'avg_guest_msgs_per_convo' | 'high_complexity_convos' |
               'talk_time'

interface AircallStats { total_calls: number; answered_calls: number; total_talk_time_seconds: number; avg_handle_time_seconds: number }
type AgentWithAircall = AgentStats & { aircall?: AircallStats | null }

interface Props {
  agents: AgentWithAircall[]
  showAircall: boolean
}

const COL_HEADER: Record<SortKey, string> = {
  total_messages_sent:    'Messages',
  adjusted_score:         'Adj. Score',
  unique_conversations:   'Convos',
  avg_reply_length_chars: 'Avg Length',
  avg_guest_msgs_per_convo: 'Complexity',
  high_complexity_convos: 'High Complexity',
  talk_time:              'Talk Time',
}

export default function AgentTable({ agents, showAircall }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('adjusted_score')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = agents
    if (tierFilter !== 'all') list = list.filter(a => a.tier === tierFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.agent_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let av: number, bv: number
      if (sortKey === 'talk_time') {
        av = a.aircall?.total_talk_time_seconds ?? 0
        bv = b.aircall?.total_talk_time_seconds ?? 0
      } else {
        av = a[sortKey] as number
        bv = b[sortKey] as number
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [agents, sortKey, sortDir, tierFilter, search])

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function SortTh({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = k === sortKey
    return (
      <th className={clsx('table-header cursor-pointer select-none hover:text-gray-200 transition-colors', active && 'text-white')}
          onClick={() => handleSort(k)}>
        <span className="inline-flex items-center gap-1">
          {children}
          {active && <span className="text-brand-500">{sortDir === 'desc' ? '↓' : '↑'}</span>}
        </span>
      </th>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-500 w-52"
          placeholder="Search agent..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {(['all', 'top', 'solid', 'developing', 'watch'] as const).map(t => (
          <button key={t} onClick={() => setTierFilter(t)}
            className={clsx('btn capitalize', tierFilter === t ? 'btn-primary' : 'btn-ghost')}>
            {t === 'all' ? 'All Tiers' : t}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{filtered.length} agents</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="table-header w-6 text-center">#</th>
              <th className="table-header">Agent</th>
              <th className="table-header">Tier</th>
              <SortTh k="total_messages_sent">Messages</SortTh>
              <SortTh k="unique_conversations">Convos</SortTh>
              <SortTh k="avg_reply_length_chars">Avg Length</SortTh>
              <SortTh k="avg_guest_msgs_per_convo">Complexity</SortTh>
              <SortTh k="high_complexity_convos">High-Cx</SortTh>
              <SortTh k="adjusted_score">Adj. Score</SortTh>
              {showAircall && <>
                <SortTh k="talk_time">Calls</SortTh>
                <SortTh k="talk_time">Talk Time</SortTh>
                <th className="table-header">Avg AHT</th>
              </>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filtered.map((a, i) => (
              <tr key={a.agent_id} className="hover:bg-gray-800/40 transition-colors">
                <td className="table-cell text-center text-gray-500 text-xs w-6">{i + 1}</td>
                <td className="table-cell">
                  <div className="font-medium text-gray-100">{a.agent_name}</div>
                  <div className="text-xs text-gray-500">{a.email}</div>
                  {a.team_name && <div className="text-xs text-gray-600">{a.team_name}</div>}
                </td>
                <td className="table-cell"><TierBadge tier={a.tier} /></td>
                <td className="table-cell font-mono font-semibold">{a.total_messages_sent}</td>
                <td className="table-cell font-mono">{a.unique_conversations}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-gray-700 w-16 overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full"
                           style={{ width: `${Math.min(100, (a.avg_reply_length_chars / 500) * 100)}%` }} />
                    </div>
                    <span className="font-mono text-xs">{a.avg_reply_length_chars}</span>
                  </div>
                </td>
                <td className="table-cell font-mono text-xs">
                  {a.avg_guest_msgs_per_convo > 0 ? a.avg_guest_msgs_per_convo.toFixed(0) : '—'}
                </td>
                <td className="table-cell">
                  <span className={clsx('font-mono text-xs', a.high_complexity_convos > 20 ? 'text-amber-400' : '')}>
                    {a.high_complexity_convos}
                  </span>
                </td>
                <td className="table-cell">
                  <span className={clsx('font-semibold font-mono',
                    a.adjusted_score >= 120 ? 'text-emerald-400' :
                    a.adjusted_score >= 50  ? 'text-blue-400' :
                    a.adjusted_score >= 20  ? 'text-amber-400' : 'text-red-400')}>
                    {a.adjusted_score}
                  </span>
                </td>
                {showAircall && <>
                  <td className="table-cell font-mono text-xs">
                    {a.aircall ? `${a.aircall.answered_calls}/${a.aircall.total_calls}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="table-cell font-mono text-xs">
                    {a.aircall?.total_talk_time_seconds
                      ? formatDuration(a.aircall.total_talk_time_seconds)
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="table-cell font-mono text-xs">
                    {a.aircall?.avg_handle_time_seconds
                      ? formatDuration(a.aircall.avg_handle_time_seconds)
                      : <span className="text-gray-600">—</span>}
                  </td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
