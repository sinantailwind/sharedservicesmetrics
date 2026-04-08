import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), '.cache')

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

function filePath(key: string) {
  return path.join(CACHE_DIR, key.replace(/[^a-z0-9]/gi, '_') + '.json')
}

interface CacheEntry<T> { data: T; expiresAt: number }

export function getCache<T>(key: string): T | null {
  try {
    const file = filePath(key)
    if (!fs.existsSync(file)) return null
    const entry: CacheEntry<T> = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Date.now() > entry.expiresAt) { fs.unlinkSync(file); return null }
    return entry.data
  } catch { return null }
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  try {
    ensureDir()
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlSeconds * 1000 }
    fs.writeFileSync(filePath(key), JSON.stringify(entry))
  } catch (e) { console.error('[cache] write error:', e) }
}

export function invalidateCache(prefix?: string): void {
  try {
    ensureDir()
    const files = fs.readdirSync(CACHE_DIR)
    for (const f of files) {
      if (!prefix || f.startsWith(prefix.replace(/[^a-z0-9]/gi, '_'))) {
        fs.unlinkSync(path.join(CACHE_DIR, f))
      }
    }
  } catch {}
}
