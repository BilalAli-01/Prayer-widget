import type { Prayer } from '../../src/types/prayer'
import type { IqamaEntry } from './goprayService'
import type { AladhanTimings } from './aladhanService'
import {
  parsePrayerTime,
  formatAdhan24,
  formatDateSydney,
  addMins,
  normaliseIqamaDisplay,
} from './timeUtils'

// ── Prayer order & Aladhan key mapping ────────────────────────────────────────

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const

const ALADHAN_KEY: Record<string, keyof AladhanTimings> = {
  Fajr: 'Fajr',
  Dhuhr: 'Dhuhr',
  Asr: 'Asr',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Merges GoPray iqama entries with Aladhan adhan timings into a Prayer[].
 * `sydneyDate` is "YYYY-MM-DD" in Sydney timezone — used to turn time strings
 * into concrete Date objects for offset-aware arithmetic.
 */
export function mergePrayerData(
  iqamaEntries: IqamaEntry[],
  adhan: AladhanTimings,
  sydneyDate: string,
): Prayer[] {
  const iqamaMap = new Map(iqamaEntries.map((e) => [e.name, e.rawDisplay]))

  return PRAYER_ORDER.map((name): Prayer => {
    const adhanKey = ALADHAN_KEY[name]
    const adhan24 = adhan[adhanKey] ?? null
    const adhanDisplay = adhan24 ? formatAdhan24(adhan24) : null

    const iqamaRaw = iqamaMap.get(name) ?? '—'
    const iqamaDisplay = normaliseIqamaDisplay(iqamaRaw)
    const iqamaCountdownTime = resolveIqamaCountdownTime(
      iqamaRaw,
      adhan24,
      adhanDisplay,
      sydneyDate,
    )

    return { name, adhanTime: adhanDisplay, iqamaDisplay, iqamaCountdownTime }
  })
}

// ── Resolution rules ──────────────────────────────────────────────────────────

/**
 * Determines the time to use for the countdown:
 *
 *  1. Fixed time ("5:30 am", "12:45 pm") → parse and return as "h:mm AM/PM"
 *  2. "Just after athaan/adhan"           → use adhan time directly
 *  3. "N mins after adhan"                → adhan + N minutes
 *  4. Anything else                       → null (display only, skip countdown)
 */
function resolveIqamaCountdownTime(
  iqamaRaw: string,
  adhan24: string | null,
  adhanDisplay: string | null,
  sydneyDate: string,
): string | null {
  const lo = iqamaRaw.toLowerCase().trim()

  // Rule 1 — fixed time string
  if (/^\d{1,2}:\d{2}\s*(am|pm)$/.test(lo)) {
    try {
      const d = parsePrayerTime(iqamaRaw, sydneyDate)
      return formatDateSydney(d)
    } catch (err) {
      console.warn('[Merge] Could not parse iqama time:', iqamaRaw, err)
      return null
    }
  }

  // Rule 2 — "just after athaan" / "just after adhan"
  if (/just after a(dha|tha)a?n/i.test(lo)) {
    return adhanDisplay
  }

  // Rule 3 — "N min(s) after adhan"
  const minsMatch = lo.match(/^(\d+)\s*min[^a-z]*after/)
  if (minsMatch && adhan24) {
    try {
      const adhanDate = parsePrayerTime(adhan24, sydneyDate)
      const iqamaDate = addMins(adhanDate, Number(minsMatch[1]))
      return formatDateSydney(iqamaDate)
    } catch (err) {
      console.warn('[Merge] Could not add minutes to adhan time:', adhan24, err)
      return null
    }
  }

  // Rule 4 — unresolvable text
  return null
}
