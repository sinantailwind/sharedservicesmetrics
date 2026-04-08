'use client'
import type { TeamPerformance, TagStat } from '@/lib/queries'

interface Props {
  teams: TeamPerformance[]
  tags: TagStat[]
}

function formatNum(n: number) {
  return n.toLocaleString()
}

export default function TeamsTagsPanel({ teams, tags }: Props) {
  const maxConvos = Math.max(...tags.map(t => t.conversation_count), 1)

  return (
    <div className="space-y-6">
      {/* Team Performance */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-100">Team Performance</h3>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-500">No team data available for this window.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="table-header">Team</th>
                  <th className="table-header text-right">Active Agents</th>
                  <th className="table-header text-right">Messages</th>
                  <th className="table-header text-right">Conversations</th>
                  <th className="table-header text-right">Avg Reply</th>
                  <th className="table-header text-right">Msgs / Convo</th>
                  <th className="table-header text-right">High-Complexity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {teams.map(team => (
                  <tr key={team.team_name} className="hover:bg-gray-800/40 transition-colors">
                    <td className="table-cell font-medium text-gray-100 max-w-xs truncate">
                      {team.team_name}
                    </td>
                    <td className="table-cell text-right font-mono">{team.active_agents}</td>
                    <td className="table-cell text-right font-mono font-semibold">{formatNum(team.total_messages)}</td>
                    <td className="table-cell text-right font-mono">{formatNum(team.unique_conversations)}</td>
                    <td className="table-cell text-right font-mono text-xs text-gray-400">
                      {team.avg_reply_length_chars} ch
                    </td>
                    <td className="table-cell text-right font-mono text-xs">
                      {team.avg_msgs_per_convo.toFixed(1)}
                    </td>
                    <td className="table-cell text-right font-mono text-xs text-amber-400">
                      {formatNum(team.high_complexity_convos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tag Breakdown */}
      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold text-gray-100">Tag Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">Conversations by category tag</p>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tag data available for this window.</p>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => {
              const pct = Math.round((tag.conversation_count / maxConvos) * 100)
              return (
                <div key={tag.tag_name} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 text-xs text-gray-300 truncate" title={tag.tag_name}>
                    {tag.tag_name}
                  </div>
                  <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-brand-500/70 rounded transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-28 shrink-0 flex items-center gap-2 text-xs font-mono">
                    <span className="text-white font-semibold">{formatNum(tag.conversation_count)}</span>
                    <span className="text-gray-500">convos</span>
                  </div>
                  <div className="w-20 shrink-0 text-xs text-gray-500 font-mono hidden sm:block">
                    {tag.agent_count} agent{tag.agent_count !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
