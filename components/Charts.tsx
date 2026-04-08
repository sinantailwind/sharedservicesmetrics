'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Legend, Cell,
} from 'recharts'
import type { AgentStats } from '@/lib/queries'

const TIER_COLOR: Record<string, string> = {
  top:        '#34d399',
  solid:      '#60a5fa',
  developing: '#fbbf24',
  watch:      '#f87171',
}

interface Props { agents: AgentStats[] }

export function TopAgentsChart({ agents }: Props) {
  const top = agents.slice(0, 15)
  const data = top.map(a => ({
    name: a.agent_name.split(' ')[0],
    Messages: a.total_messages_sent,
    fill: TIER_COLOR[a.tier],
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
          itemStyle={{ color: '#9ca3af' }}
        />
        <Bar dataKey="Messages" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ComplexityScatterChart({ agents }: Props) {
  const data = agents.map(a => ({
    x: a.total_messages_sent,
    y: a.avg_reply_length_chars,
    z: a.high_complexity_convos,
    name: a.agent_name,
    tier: a.tier,
  }))

  const byTier = ['top', 'solid', 'developing', 'watch'].map(tier => ({
    tier,
    data: data.filter(d => d.tier === tier),
    color: TIER_COLOR[tier],
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="x" name="Messages" type="number" tick={{ fill: '#9ca3af', fontSize: 11 }}
               label={{ value: 'Messages sent', fill: '#6b7280', fontSize: 11, position: 'insideBottom', offset: -2 }} />
        <YAxis dataKey="y" name="Avg Reply Length" type="number" tick={{ fill: '#9ca3af', fontSize: 11 }}
               label={{ value: 'Avg chars', fill: '#6b7280', fontSize: 11, angle: -90, position: 'insideLeft' }} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          formatter={(val, name) => [val, name]}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-white">{d.name}</p>
                <p className="text-gray-400">Messages: <span className="text-white">{d.x}</span></p>
                <p className="text-gray-400">Avg length: <span className="text-white">{d.y} chars</span></p>
                <p className="text-gray-400">High-cx convos: <span className="text-white">{d.z}</span></p>
              </div>
            )
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
        {byTier.map(({ tier, data: d, color }) => (
          <Scatter key={tier} name={tier.charAt(0).toUpperCase() + tier.slice(1)} data={d} fill={color} opacity={0.8} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
