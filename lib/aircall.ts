export interface AircallUser {
  id: number
  name: string
  email: string
  direct_link: string
  availability: string
}

export interface AircallCall {
  id: number
  direction: 'inbound' | 'outbound'
  status: 'done' | 'answered' | 'missed' | 'voicemail'
  started_at: number
  answered_at: number | null
  ended_at: number | null
  duration: number       // seconds (total call)
  answered_duration: number // seconds (talk time only)
  user: { id: number; name: string; email: string } | null
  recording: string | null
  transcription: AircallTranscription | null
  raw_digits: string
  asset: string | null
  insights: AircallInsight[]
}

export interface AircallTranscription {
  status: 'done' | 'in_progress' | 'not_done'
  calls: AircallTranscriptSegment[]
}

export interface AircallTranscriptSegment {
  id: string
  type: 'agent' | 'customer'
  content: string
  timestamp: number
}

export interface AircallInsight {
  type: string
  content: string
}

export interface AircallAgentStats {
  aircall_user_id: number | null
  total_calls: number
  answered_calls: number
  missed_calls: number
  inbound_calls: number
  outbound_calls: number
  pickup_rate: number          // 0-100 percentage
  missed_call_rate: number     // 0-100 percentage
  total_talk_time_seconds: number
  avg_handle_time_seconds: number
  longest_call_seconds: number
  shortest_call_seconds: number
  total_hold_time_seconds: number
  avg_wait_time_seconds: number  // avg time before pickup on inbound answered
}

export interface TranscriptFinding {
  agent_name: string
  call_id: number
  duration_seconds: number
  findings: string[]
}

const AIRCALL_BASE = 'https://api.aircall.io/v1'

function authHeader(): string {
  const id = process.env.AIRCALL_API_ID
  const token = process.env.AIRCALL_API_TOKEN
  if (!id || !token) throw new Error('AIRCALL_API_ID or AIRCALL_API_TOKEN not set')
  return 'Basic ' + Buffer.from(`${id}:${token}`).toString('base64')
}

export function aircallEnabled(): boolean {
  return !!(process.env.AIRCALL_API_ID && process.env.AIRCALL_API_TOKEN)
}

async function aircallGet<T>(path: string): Promise<T> {
  const res = await fetch(`${AIRCALL_BASE}${path}`, {
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Aircall API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAircallUsers(): Promise<AircallUser[]> {
  const data = await aircallGet<{ users: AircallUser[] }>('/users?per_page=100')
  return data.users
}

async function fetchCallsPage(from: number, to: number, page: number): Promise<AircallCall[]> {
  const data = await aircallGet<{ calls: AircallCall[]; meta: { next_page_link: string | null } }>(
    `/calls?from=${from}&to=${to}&per_page=50&page=${page}&order=desc`
  )
  return data.calls
}

export async function fetchAllCalls(hours: number = 24): Promise<AircallCall[]> {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - hours * 3600

  // Estimate max pages: ~200 calls/day, 50 per page, plus buffer
  const estimatedDays = hours / 24
  const maxPages = Math.min(Math.ceil((estimatedDays * 300) / 50), 500)

  const calls: AircallCall[] = []
  let page = 1
  while (true) {
    const batch = await fetchCallsPage(from, to, page)
    calls.push(...batch)
    if (batch.length < 50) break
    page++
    if (page > maxPages) {
      console.warn(`[aircall] hit page cap (${maxPages}) at ${calls.length} calls`)
      break
    }
  }
  return calls
}

export function aggregateByAgent(
  calls: AircallCall[],
  aircallUsers: AircallUser[]
): Map<string, AircallAgentStats> {
  const emailMap = new Map(aircallUsers.map(u => [u.email.toLowerCase(), u.id]))
  const byEmail = new Map<string, AircallAgentStats>()

  const waitTimes = new Map<string, number[]>()

  for (const call of calls) {
    if (!call.user?.email) continue
    const email = call.user.email.toLowerCase()
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        aircall_user_id: emailMap.get(email) ?? null,
        total_calls: 0,
        answered_calls: 0,
        missed_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        pickup_rate: 0,
        missed_call_rate: 0,
        total_talk_time_seconds: 0,
        avg_handle_time_seconds: 0,
        longest_call_seconds: 0,
        shortest_call_seconds: Infinity,
        total_hold_time_seconds: 0,
        avg_wait_time_seconds: 0,
      })
      waitTimes.set(email, [])
    }
    const s = byEmail.get(email)!
    s.total_calls++
    if (call.direction === 'inbound') s.inbound_calls++
    else s.outbound_calls++

    const isAnswered = call.status === 'answered' || (call.answered_at != null)
    const talkTime = call.duration ?? 0

    if (isAnswered && talkTime > 0) {
      s.answered_calls++
      s.total_talk_time_seconds += talkTime
      s.longest_call_seconds = Math.max(s.longest_call_seconds, talkTime)
      s.shortest_call_seconds = Math.min(s.shortest_call_seconds, talkTime)
      if (call.answered_at && call.started_at) {
        const wait = call.answered_at - call.started_at
        if (wait > 0) waitTimes.get(email)!.push(wait)
      }
    } else {
      s.missed_calls++
    }
  }

  for (const s of Array.from(byEmail.values())) {
    if (s.shortest_call_seconds === Infinity) s.shortest_call_seconds = 0
    s.avg_handle_time_seconds = s.answered_calls > 0
      ? Math.round(s.total_talk_time_seconds / s.answered_calls)
      : 0
    s.pickup_rate = s.total_calls > 0 ? Math.round((s.answered_calls / s.total_calls) * 100) : 0
    s.missed_call_rate = s.total_calls > 0 ? Math.round((s.missed_calls / s.total_calls) * 100) : 0
    const wt = waitTimes.get(Array.from(byEmail.entries()).find(([, v]) => v === s)?.[0] ?? '') ?? []
    s.avg_wait_time_seconds = wt.length > 0 ? Math.round(wt.reduce((a, b) => a + b, 0) / wt.length) : 0
  }

  return byEmail
}

// ─── Transcript Analysis ────────────────────────────────────────────────────

interface TranscriptAnalysis {
  agentEmail: string
  callId: number
  durationSeconds: number
  findings: string[]
  score: number // 0-100, lower = more issues
}

const AHT_PATTERNS = [
  { pattern: /hold on|one moment|let me check|bear with me|just a second/i, label: 'Frequent hold requests — agent may lack immediate access to info' },
  { pattern: /can you repeat|sorry, what was|could you say that again/i, label: 'Repeated clarifications — possible audio issue or unclear communication' },
  { pattern: /i don\'t know|i\'m not sure|i\'ll have to check with my/i, label: 'Knowledge gaps — agent escalating or deferring answers' },
  { pattern: /let me transfer|i\'ll transfer you|pass you to/i, label: 'Call transfers — may indicate misrouted calls or skill gap' },
  { pattern: /call you back|give us a call back|call us again/i, label: 'Callbacks promised — first call resolution not achieved' },
]

export function analyzeTranscript(call: AircallCall, agentEmail: string): TranscriptAnalysis | null {
  if (!call.transcription || call.transcription.status !== 'done') return null

  const fullText = call.transcription.calls.map(s => s.content).join(' ')
  const findings: string[] = []

  for (const { pattern, label } of AHT_PATTERNS) {
    if (pattern.test(fullText)) findings.push(label)
  }

  // Detect long agent turns (potential rambling)
  const agentSegments = call.transcription.calls.filter(s => s.type === 'agent')
  const avgAgentWords = agentSegments.length > 0
    ? agentSegments.reduce((sum, s) => sum + s.content.split(' ').length, 0) / agentSegments.length
    : 0
  if (avgAgentWords > 80) {
    findings.push('Long agent responses — consider more concise communication to reduce AHT')
  }

  // Detect guest frustration language
  if (/already told|again\?|as i said|why is this|this is ridiculous|unbelievable/i.test(fullText)) {
    findings.push('Guest frustration detected — review resolution path and empathy signals')
  }

  const score = Math.max(0, 100 - findings.length * 20)

  return { agentEmail, callId: call.id, durationSeconds: call.answered_duration ?? 0, findings, score }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}
