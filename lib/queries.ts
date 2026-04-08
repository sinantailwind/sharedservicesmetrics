import { query } from './db'

export interface AgentStats {
  agent_id: number
  agent_name: string
  email: string
  role: string
  team_name: string | null
  total_messages_sent: number
  manual_messages: number
  ai_assisted_messages: number
  unique_conversations: number
  avg_reply_length_chars: number
  max_reply_length_chars: number
  msgs_per_convo: number
  voice_messages: number
  // complexity
  msgs_with_knowledge_gap: number
  avg_guest_msgs_per_convo: number
  avg_total_msgs_per_convo: number
  max_guest_msgs_in_a_convo: number
  high_complexity_convos: number
  medium_complexity_convos: number
  low_complexity_convos: number
  // computed
  tier: 'top' | 'solid' | 'developing' | 'watch'
  adjusted_score: number
}

export interface InactiveAgent {
  agent_id: number
  agent_name: string
  email: string
  team_name: string | null
  last_seen_at: string | null
  msgs_last_7d: number
  status: 'zero_this_week' | 'absent_today' | 'dormant'
}

function computeTier(a: Omit<AgentStats, 'tier' | 'adjusted_score'>): AgentStats['tier'] {
  const score = a.total_messages_sent * (a.avg_reply_length_chars / 250)
  if (score >= 120) return 'top'
  if (score >= 50) return 'solid'
  if (score >= 20) return 'developing'
  return 'watch'
}

function computeAdjustedScore(a: Omit<AgentStats, 'tier' | 'adjusted_score'>): number {
  return Math.round(a.total_messages_sent * (a.avg_reply_length_chars / 250))
}

export async function fetchAgentReport(hours: number = 24): Promise<AgentStats[]> {
  const interval = `${hours} hours`

  const performanceRows = await query<Record<string, unknown>>(`
    SELECT
      eu.id                                                              AS agent_id,
      eu."firstName" || ' ' || eu."lastName"                            AS agent_name,
      eu.email,
      eu.role,
      t."name"                                                           AS team_name,
      COUNT(*)                                                           AS total_messages_sent,
      SUM(CASE WHEN cm."isAutomated" = false OR cm."isAutomated" IS NULL THEN 1 ELSE 0 END) AS manual_messages,
      SUM(CASE WHEN cm."isAutomated" = true THEN 1 ELSE 0 END)          AS ai_assisted_messages,
      COUNT(DISTINCT cm."conversationId")                                AS unique_conversations,
      COALESCE(ROUND(AVG(LENGTH(cm."messageBody"))::numeric, 0), 0)     AS avg_reply_length_chars,
      COALESCE(MAX(LENGTH(cm."messageBody")), 0)                        AS max_reply_length_chars,
      ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT cm."conversationId"), 0)), 2) AS msgs_per_convo,
      SUM(CASE WHEN cm."messageType" = 'VOICE' THEN 1 ELSE 0 END)      AS voice_messages
    FROM conversation_messages cm
    JOIN extenteam_users eu ON eu.id = cm."userId"
    LEFT JOIN teams t ON t.id = eu."teamId"
    WHERE cm."conversationMessageType" = 'AGENT'
      AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
      AND cm."deletedAt" IS NULL
    GROUP BY eu.id, eu."firstName", eu."lastName", eu.email, eu.role, t."name"
    ORDER BY total_messages_sent DESC
  `)

  const complexityRows = await query<Record<string, unknown>>(`
    SELECT
      eu.id AS agent_id,
      SUM(CASE WHEN cm."hasKnowledgeGap" = true THEN 1 ELSE 0 END)        AS msgs_with_knowledge_gap,
      COALESCE(ROUND(AVG(gd.guest_count)::numeric, 1), 0)                 AS avg_guest_msgs_per_convo,
      COALESCE(ROUND(AVG(td.total_count)::numeric, 1), 0)                 AS avg_total_msgs_per_convo,
      COALESCE(MAX(gd.guest_count), 0)                                     AS max_guest_msgs_in_a_convo,
      SUM(CASE WHEN gd.guest_count >= 10 THEN 1 ELSE 0 END)               AS high_complexity_convos,
      SUM(CASE WHEN gd.guest_count BETWEEN 4 AND 9 THEN 1 ELSE 0 END)     AS medium_complexity_convos,
      SUM(CASE WHEN gd.guest_count <= 3 THEN 1 ELSE 0 END)                AS low_complexity_convos
    FROM conversation_messages cm
    JOIN extenteam_users eu ON eu.id = cm."userId"
    LEFT JOIN (
      SELECT "conversationId", COUNT(*) AS guest_count
      FROM conversation_messages
      WHERE "conversationMessageType" = 'GUEST' AND "deletedAt" IS NULL
      GROUP BY "conversationId"
    ) gd ON gd."conversationId" = cm."conversationId"
    LEFT JOIN (
      SELECT "conversationId", COUNT(*) AS total_count
      FROM conversation_messages
      WHERE "deletedAt" IS NULL
      GROUP BY "conversationId"
    ) td ON td."conversationId" = cm."conversationId"
    WHERE cm."conversationMessageType" = 'AGENT'
      AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
      AND cm."deletedAt" IS NULL
    GROUP BY eu.id
  `)

  const complexityMap = new Map(complexityRows.map(r => [Number(r.agent_id), r]))

  return performanceRows.map(r => {
    const c = complexityMap.get(Number(r.agent_id)) ?? {}
    const base: Omit<AgentStats, 'tier' | 'adjusted_score'> = {
      agent_id:               Number(r.agent_id),
      agent_name:             String(r.agent_name),
      email:                  String(r.email),
      role:                   String(r.role),
      team_name:              r.team_name ? String(r.team_name) : null,
      total_messages_sent:    Number(r.total_messages_sent),
      manual_messages:        Number(r.manual_messages),
      ai_assisted_messages:   Number(r.ai_assisted_messages),
      unique_conversations:   Number(r.unique_conversations),
      avg_reply_length_chars: Number(r.avg_reply_length_chars),
      max_reply_length_chars: Number(r.max_reply_length_chars),
      msgs_per_convo:         Number(r.msgs_per_convo),
      voice_messages:         Number(r.voice_messages),
      msgs_with_knowledge_gap: Number(c.msgs_with_knowledge_gap ?? 0),
      avg_guest_msgs_per_convo: Number(c.avg_guest_msgs_per_convo ?? 0),
      avg_total_msgs_per_convo: Number(c.avg_total_msgs_per_convo ?? 0),
      max_guest_msgs_in_a_convo: Number(c.max_guest_msgs_in_a_convo ?? 0),
      high_complexity_convos: Number(c.high_complexity_convos ?? 0),
      medium_complexity_convos: Number(c.medium_complexity_convos ?? 0),
      low_complexity_convos:  Number(c.low_complexity_convos ?? 0),
    }
    return { ...base, tier: computeTier(base), adjusted_score: computeAdjustedScore(base) }
  })
}

export async function fetchInactiveAgents(hours: number = 24): Promise<InactiveAgent[]> {
  const interval = `${hours} hours`
  const rows = await query<Record<string, unknown>>(`
    SELECT
      eu.id                                                     AS agent_id,
      eu."firstName" || ' ' || eu."lastName"                   AS agent_name,
      eu.email,
      t."name"                                                  AS team_name,
      eu."lastSeenAt"                                           AS last_seen_at,
      (
        SELECT COUNT(*) FROM conversation_messages cm2
        WHERE cm2."userId" = eu.id
          AND cm2."conversationMessageType" = 'AGENT'
          AND cm2."deletedAt" IS NULL
          AND cm2."messageCreatedAt" >= NOW() - INTERVAL '7 days'
      )::int                                                    AS msgs_last_7d
    FROM extenteam_users eu
    LEFT JOIN teams t ON t.id = eu."teamId"
    WHERE eu.role = 'EXTENTEAM_AGENT'
      AND eu.status = 'ACTIVE'
      AND eu."deletedAt" IS NULL
      AND eu.id NOT IN (
        SELECT DISTINCT cm."userId" FROM conversation_messages cm
        WHERE cm."conversationMessageType" = 'AGENT'
          AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
          AND cm."deletedAt" IS NULL
          AND cm."userId" IS NOT NULL
      )
    ORDER BY msgs_last_7d DESC, agent_name
  `)

  return rows.map(r => {
    const lastSeen = r.last_seen_at ? new Date(String(r.last_seen_at)) : null
    const daysSinceLastSeen = lastSeen
      ? (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      : 999
    const msgs7d = Number(r.msgs_last_7d)

    let status: InactiveAgent['status']
    if (daysSinceLastSeen > 30 || (daysSinceLastSeen > 7 && msgs7d === 0)) {
      status = 'dormant'
    } else if (msgs7d === 0) {
      status = 'zero_this_week'
    } else {
      status = 'absent_today'
    }

    return {
      agent_id:   Number(r.agent_id),
      agent_name: String(r.agent_name),
      email:      String(r.email),
      team_name:  r.team_name ? String(r.team_name) : null,
      last_seen_at: r.last_seen_at ? String(r.last_seen_at) : null,
      msgs_last_7d: msgs7d,
      status,
    }
  })
}

export interface AgentSessionStats {
  agent_id: number
  agent_name: string
  email: string
  session_count: number
  first_seen: string | null
  last_seen: string | null
  /** Approximate active window in minutes (last_seen - first_seen) */
  active_window_minutes: number
  /** Messages sent ÷ active window hours — messages per logged-in hour */
  msgs_per_active_hour: number
  total_messages: number
}

export async function fetchSessionStats(hours: number = 24): Promise<AgentSessionStats[]> {
  const interval = `${hours} hours`
  const rows = await query<Record<string, unknown>>(`
    WITH agent_msgs AS (
      SELECT "userId", COUNT(*) AS total_messages
      FROM conversation_messages
      WHERE "conversationMessageType" = 'AGENT'
        AND "messageCreatedAt" >= NOW() - INTERVAL '${interval}'
        AND "deletedAt" IS NULL
        AND "userId" IS NOT NULL
      GROUP BY "userId"
    ),
    agent_sessions AS (
      SELECT
        s."userId",
        COUNT(s.id)                                        AS session_count,
        MIN(s."createdAt")                                 AS first_seen,
        MAX(s."updatedAt")                                 AS last_seen,
        EXTRACT(EPOCH FROM (MAX(s."updatedAt") - MIN(s."createdAt"))) / 60 AS active_window_minutes
      FROM auth_sessions s
      WHERE s."createdAt" >= NOW() - INTERVAL '${interval}'
        AND s."userId" IS NOT NULL
      GROUP BY s."userId"
    )
    SELECT
      eu.id                                               AS agent_id,
      eu."firstName" || ' ' || eu."lastName"             AS agent_name,
      eu.email,
      COALESCE(ses.session_count, 0)::int                AS session_count,
      ses.first_seen,
      ses.last_seen,
      COALESCE(ROUND(ses.active_window_minutes::numeric, 0), 0) AS active_window_minutes,
      COALESCE(m.total_messages, 0)::int                 AS total_messages,
      CASE
        WHEN ses.active_window_minutes > 0
        THEN ROUND((COALESCE(m.total_messages, 0) / (ses.active_window_minutes / 60.0))::numeric, 1)
        ELSE 0
      END                                                 AS msgs_per_active_hour
    FROM extenteam_users eu
    LEFT JOIN agent_sessions ses ON ses."userId" = eu.id
    LEFT JOIN agent_msgs m ON m."userId" = eu.id
    WHERE eu.role IN ('EXTENTEAM_AGENT', 'EXTENTEAM_ADMIN')
      AND eu.status = 'ACTIVE'
      AND eu."deletedAt" IS NULL
      AND (ses."userId" IS NOT NULL OR m."userId" IS NOT NULL)
    ORDER BY msgs_per_active_hour DESC
  `)

  return rows.map(r => ({
    agent_id:              Number(r.agent_id),
    agent_name:            String(r.agent_name),
    email:                 String(r.email),
    session_count:         Number(r.session_count),
    first_seen:            r.first_seen ? String(r.first_seen) : null,
    last_seen:             r.last_seen ? String(r.last_seen) : null,
    active_window_minutes: Number(r.active_window_minutes),
    total_messages:        Number(r.total_messages),
    msgs_per_active_hour:  Number(r.msgs_per_active_hour),
  }))
}

export interface TeamPerformance {
  team_name: string
  active_agents: number
  total_messages: number
  unique_conversations: number
  avg_reply_length_chars: number
  high_complexity_convos: number
  avg_msgs_per_convo: number
}

export interface TagStat {
  tag_name: string
  conversation_count: number
  agent_count: number
  message_count: number
}

export async function fetchTeamPerformance(hours: number = 24): Promise<TeamPerformance[]> {
  const interval = `${hours} hours`
  const rows = await query<Record<string, unknown>>(`
    SELECT
      COALESCE(t."name", 'Unassigned')                                     AS team_name,
      COUNT(DISTINCT eu.id)                                                 AS active_agents,
      COUNT(*)                                                              AS total_messages,
      COUNT(DISTINCT cm."conversationId")                                   AS unique_conversations,
      COALESCE(ROUND(AVG(LENGTH(cm."messageBody"))::numeric, 0), 0)        AS avg_reply_length_chars,
      COUNT(DISTINCT CASE WHEN gd.guest_count >= 10 THEN cm."conversationId" END) AS high_complexity_convos,
      ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT cm."conversationId"), 0)), 2) AS avg_msgs_per_convo
    FROM conversation_messages cm
    JOIN extenteam_users eu ON eu.id = cm."userId"
    LEFT JOIN teams t ON t.id = eu."teamId"
    LEFT JOIN (
      SELECT "conversationId", COUNT(*) AS guest_count
      FROM conversation_messages
      WHERE "conversationMessageType" = 'GUEST' AND "deletedAt" IS NULL
      GROUP BY "conversationId"
    ) gd ON gd."conversationId" = cm."conversationId"
    WHERE cm."conversationMessageType" = 'AGENT'
      AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
      AND cm."deletedAt" IS NULL
    GROUP BY COALESCE(t."name", 'Unassigned')
    ORDER BY total_messages DESC
  `)
  return rows.map(r => ({
    team_name:             String(r.team_name),
    active_agents:         Number(r.active_agents),
    total_messages:        Number(r.total_messages),
    unique_conversations:  Number(r.unique_conversations),
    avg_reply_length_chars: Number(r.avg_reply_length_chars),
    high_complexity_convos: Number(r.high_complexity_convos),
    avg_msgs_per_convo:    Number(r.avg_msgs_per_convo),
  }))
}

export async function fetchTagBreakdown(hours: number = 24): Promise<TagStat[]> {
  const interval = `${hours} hours`
  const rows = await query<Record<string, unknown>>(`
    SELECT
      ct."tagValue"                                                         AS tag_name,
      COUNT(DISTINCT ct."conversationId")                                   AS conversation_count,
      COUNT(DISTINCT cm."userId")                                           AS agent_count,
      COUNT(DISTINCT cm.id)                                                 AS message_count
    FROM conversation_tags ct
    JOIN conversation_messages cm ON cm."conversationId" = ct."conversationId"
    WHERE cm."conversationMessageType" = 'AGENT'
      AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
      AND cm."deletedAt" IS NULL
      AND ct."tagValue" IS NOT NULL
      AND ct."tagValue" != ''
    GROUP BY ct."tagValue"
    ORDER BY conversation_count DESC
    LIMIT 25
  `)
  return rows.map(r => ({
    tag_name:           String(r.tag_name),
    conversation_count: Number(r.conversation_count),
    agent_count:        Number(r.agent_count),
    message_count:      Number(r.message_count),
  }))
}

export async function fetchSummaryStats(hours: number = 24): Promise<{
  total_messages: number
  active_agents: number
  total_conversations: number
  avg_reply_length: number
}> {
  const interval = `${hours} hours`
  const rows = await query<Record<string, unknown>>(`
    SELECT
      COUNT(*)                                              AS total_messages,
      COUNT(DISTINCT cm."userId")                          AS active_agents,
      COUNT(DISTINCT cm."conversationId")                  AS total_conversations,
      ROUND(AVG(LENGTH(cm."messageBody"))::numeric, 0)     AS avg_reply_length
    FROM conversation_messages cm
    WHERE cm."conversationMessageType" = 'AGENT'
      AND cm."messageCreatedAt" >= NOW() - INTERVAL '${interval}'
      AND cm."deletedAt" IS NULL
      AND cm."userId" IS NOT NULL
  `)
  const r = rows[0]
  return {
    total_messages:    Number(r.total_messages),
    active_agents:     Number(r.active_agents),
    total_conversations: Number(r.total_conversations),
    avg_reply_length:  Number(r.avg_reply_length),
  }
}
