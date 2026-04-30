import Store from 'electron-store'
import type { PrayerData } from '../src/types/prayer'
import { fetchIqamaTimes, type IqamaEntry } from './services/goprayService'
import { fetchAdhanTimes, type AladhanTimings } from './services/aladhanService'
import { mergePrayerData } from './services/prayerMergeService'
import { todayStrSydney, tomorrowStr, parsePrayerTime } from './services/timeUtils'
import type { TomorrowFajr } from '../src/types/prayer'
import config from './config'

// ── Persistent cache ──────────────────────────────────────────────────────────

interface CacheSchema {
  prayerCache: PrayerData | null
}

const cache = new Store<CacheSchema>({
  name: 'prayer-cache',
  defaults: { prayerCache: null },
})

// ── Fetch + cache ─────────────────────────────────────────────────────────────

/**
 * Fetches GoPray + Aladhan in parallel using allSettled so neither source can
 * block the other. The result is cached regardless of whether one source failed.
 *
 * Failure modes:
 *   - GoPray fails, Aladhan ok  → show adhan times, iqama = "—", isOffline=true
 *   - Aladhan fails, GoPray ok  → show iqama times, no adhan column, isOffline=true
 *   - Both fail                 → return stale cache (isOffline=true), or throw
 */
export async function fetchAndCache(): Promise<PrayerData> {
  const today = todayStrSydney()
  console.log('[PrayerData] Fetching for', today)

  const [iqamaResult, adhanResult] = await Promise.allSettled([
    fetchIqamaTimes(),
    fetchAdhanTimes(),
  ])

  const iqamaOk = iqamaResult.status === 'fulfilled'
  const adhanOk = adhanResult.status === 'fulfilled'

  if (!iqamaOk) {
    console.warn('[PrayerData] GoPray failed:', (iqamaResult.reason as Error).message)
  }
  if (!adhanOk) {
    console.warn('[PrayerData] Aladhan failed:', (adhanResult.reason as Error).message)
  }

  // Both sources failed → fall back to stale cache
  if (!iqamaOk && !adhanOk) {
    const stored = cache.get('prayerCache')
    if (stored) {
      console.warn('[PrayerData] Both sources failed — using stale cache from', stored.date)
      // tomorrowFajr in stale cache may be out of date by a day, but it's the
      // best we have; the widget still shows a countdown rather than being blank.
      return { ...stored, isOffline: true }
    }
    throw new Error(
      `Both data sources failed and no cache exists.\n` +
        `GoPray: ${(iqamaResult.reason as Error).message}\n` +
        `Aladhan: ${(adhanResult.reason as Error).message}`,
    )
  }

  // At least one source succeeded — build the best data we have.
  // When GoPray fails, substitute the hardcoded fallback times from config
  // so the countdown still works rather than showing all "—".
  const iqamaEntries: IqamaEntry[] = iqamaOk
    ? iqamaResult.value
    : Object.entries(config.fallbackIqama).map(([name, rawDisplay]) => ({ name, rawDisplay }))

  const adhanTimings: AladhanTimings = adhanOk
    ? adhanResult.value
    : ({} as AladhanTimings)

  const prayers = mergePrayerData(iqamaEntries, adhanTimings, today)

  // Mark offline if either source was unavailable
  const isOffline = !iqamaOk || !adhanOk

  const data: PrayerData = {
    prayers,
    date: today,
    fetchedAt: Date.now(),
    isOffline,
    tomorrowFajr: buildTomorrowFajr(iqamaEntries, today),
  }

  cache.set('prayerCache', data)
  console.log(
    `[PrayerData] Cached | gopray:${iqamaOk ? 'ok' : 'FAIL'} aladhan:${adhanOk ? 'ok' : 'FAIL'}`,
  )
  return data
}

// ── Tomorrow Fajr helper ──────────────────────────────────────────────────────

/**
 * Computes the epoch ms (and display string) for tomorrow's Fajr iqama.
 *
 * The mosque's Fajr iqama rule (e.g. "5:30 AM") is fixed — it doesn't depend
 * on the astronomical adhan time. So we re-use today's resolved iqamaCountdownTime
 * and simply place it on tomorrow's Sydney date.
 *
 * For "X min after adhan" or "Just after Adhan" rules the iqamaCountdownTime
 * was already resolved to a concrete time today (e.g. "5:35 AM"). Using that
 * same clock-time tomorrow is accurate to within 1–2 minutes for Fajr, which
 * is good enough for an overnight countdown.
 */
function buildTomorrowFajr(iqamaEntries: IqamaEntry[], todaySydney: string): TomorrowFajr | null {
  const fajrEntry = iqamaEntries.find((e) => e.name === 'Fajr')
  if (!fajrEntry) return null

  // Resolve just the Fajr iqama display string (normalised form).
  // We need the concrete time — skip unresolvable entries like "—".
  const lo = fajrEntry.rawDisplay.toLowerCase().trim()
  const isFixedTime = /^\d{1,2}:\d{2}\s*(am|pm)$/.test(lo)
  if (!isFixedTime) {
    // "Just after Adhan" / "X min after adhan" — iqamaCountdownTime was resolved
    // by mergePrayerData; we can't re-resolve without tomorrow's adhan time.
    // Use today's resolved value as a close approximation (Fajr adhan shifts ~1 min/day).
    // If we have no way to get a time, skip.
    return null
  }

  const tomorrow = tomorrowStr(todaySydney)
  try {
    const date = parsePrayerTime(fajrEntry.rawDisplay, tomorrow)
    const display = fajrEntry.rawDisplay
      .trim()
      .replace(/\bam\b/i, 'AM')
      .replace(/\bpm\b/i, 'PM')
    return { display, timeMs: date.getTime() }
  } catch {
    return null
  }
}

/**
 * Returns cached data if it is for today and fully online; otherwise fetches.
 */
export async function getPrayerData(): Promise<PrayerData> {
  const today = todayStrSydney()
  const stored = cache.get('prayerCache')

  if (stored && stored.date === today && !stored.isOffline) {
    console.log('[PrayerData] Cache hit for', today)
    return stored
  }

  return fetchAndCache()
}

// ── Daily refresh ─────────────────────────────────────────────────────────────

let refreshTimer: ReturnType<typeof setInterval> | null = null

export function startDailyRefresh(): void {
  if (refreshTimer) return

  refreshTimer = setInterval(async () => {
    const stored = cache.get('prayerCache')
    const today = todayStrSydney()

    if (!stored || stored.date !== today) {
      console.log('[PrayerData] New Sydney day — refreshing')
      try {
        await fetchAndCache()
      } catch (err) {
        console.error('[PrayerData] Daily refresh failed:', (err as Error).message)
      }
    }
  }, 60_000)
}

export function stopDailyRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
