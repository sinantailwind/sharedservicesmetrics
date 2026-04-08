/**
 * Dashboard configuration — edit these values to tune behavior
 * without touching query or component logic.
 */

export const config = {
  // ─── Tier thresholds (based on complexity-adjusted score) ───────────────
  // Adjusted score = messages_sent × (avg_reply_length / REPLY_LENGTH_BASELINE)
  tiers: {
    top:        120,   // score >= this → Top
    solid:      50,    // score >= this → Solid
    developing: 20,    // score >= this → Developing
    // below developing → Watch
  },

  // ─── Complexity scoring ──────────────────────────────────────────────────
  // Baseline reply length used to normalize scores across agents
  replyLengthBaseline: 250, // chars

  // Guest message thresholds for conversation complexity buckets
  complexity: {
    high:   10,  // >= this many guest msgs → high complexity
    medium:  4,  // >= this → medium, below → low
  },

  // ─── Cache TTL ───────────────────────────────────────────────────────────
  cache: {
    ttlSeconds24h:  60,   // seconds to cache 24h/48h reports
    ttlSecondsLong: 300,  // seconds to cache 7d/30d reports
  },

  // ─── Inactive agent flags ────────────────────────────────────────────────
  inactive: {
    dormantDaysWithoutLogin: 30,  // last seen > N days ago → dormant
    dormantDaysNoMessages:    7,  // last seen > N days AND 0 msgs → dormant
  },

  // ─── Session activity ────────────────────────────────────────────────────
  sessions: {
    // Agents with logged-in window > this (mins) but msgs/hr below threshold are flagged
    minWindowMinutes:   30,
    lowProductivityRate: 5,  // msgs per active hour below this → flagged red
  },

  // ─── Aircall transcript analysis patterns ────────────────────────────────
  // Add/remove patterns to tune what gets flagged in AHT analysis
  ahtPatterns: [
    { pattern: /hold on|one moment|let me check|bear with me|just a second/i,
      label: 'Frequent hold requests — agent may lack immediate access to info' },
    { pattern: /can you repeat|sorry, what was|could you say that again/i,
      label: 'Repeated clarifications — possible audio issue or unclear communication' },
    { pattern: /i don\'t know|i\'m not sure|i\'ll have to check with my/i,
      label: 'Knowledge gaps — agent escalating or deferring answers' },
    { pattern: /let me transfer|i\'ll transfer you|pass you to/i,
      label: 'Call transfers — may indicate misrouted calls or skill gap' },
    { pattern: /call you back|give us a call back|call us again/i,
      label: 'Callbacks promised — first call resolution not achieved' },
  ],

  // Avg agent words per transcript segment above this → flagged as rambling
  ahtMaxAvgWordsPerSegment: 80,
}
