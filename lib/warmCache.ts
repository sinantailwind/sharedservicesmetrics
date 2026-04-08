/**
 * Warms the report cache on server startup and then every 60 seconds.
 * Import this once from instrumentation.ts so it runs in the Node.js process.
 */
import { fetchAgentReport, fetchInactiveAgents, fetchSummaryStats, fetchSessionStats, fetchTeamPerformance, fetchTagBreakdown } from './queries'
import { setCache } from './cache'
import { config } from './config'

const WINDOWS = [24, 48, 168, 720]

async function refreshWindow(hours: number) {
  try {
    const [agents, inactive, summary, sessions, teams, tags] = await Promise.all([
      fetchAgentReport(hours),
      fetchInactiveAgents(hours),
      fetchSummaryStats(hours),
      fetchSessionStats(hours),
      fetchTeamPerformance(hours),
      fetchTagBreakdown(hours),
    ])
    const ttl = hours <= 48 ? config.cache.ttlSeconds24h : config.cache.ttlSecondsLong
    setCache(`report:db:${hours}`, { agents, inactive, summary, sessions, teams, tags }, ttl + 30)
    console.log(`[cache] warmed ${hours}h window — ${agents.length} agents`)
  } catch (e) {
    console.error(`[cache] failed to warm ${hours}h window:`, e)
  }
}

export async function warmAllWindows() {
  // Warm 24h first (most used), then others in background
  await refreshWindow(24)
  for (const h of [48, 168, 720]) {
    refreshWindow(h).catch(() => {})
  }
}

let started = false
export function startCacheWarmer() {
  if (started) return
  started = true

  // Warm immediately on startup
  warmAllWindows()

  // Then refresh the 24h window every 60s
  setInterval(() => refreshWindow(24), 60 * 1000)

  // Refresh longer windows every 5 min
  setInterval(() => {
    for (const h of [48, 168, 720]) refreshWindow(h).catch(() => {})
  }, 5 * 60 * 1000)
}
