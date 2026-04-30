import type { Prayer, TomorrowFajr } from '../types/prayer'

export interface NextIqama {
  prayer: Prayer
  secondsUntil: number
  label: string // "2:30:15" or "45:02"
}

// ── Time parsing ──────────────────────────────────────────────────────────────

function sydneyOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, number>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = Number(p.value)
      return acc
    }, {})

  const sydneyAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second ?? 0,
  )
  return sydneyAsUtc - date.getTime()
}

/** Parses "5:30 AM" / "12:45 PM" as a UTC Date set to today in Sydney time. */
function parseDisplayTime(timeStr: string): Date | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null

  let h = Number(m[1])
  const min = Number(m[2])
  const ampm = m[3].toUpperCase()

  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0

  const sydneyDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const [yr, mo, da] = sydneyDate.split('-').map(Number)
  const probe = new Date(Date.UTC(yr, mo - 1, da, h, min))
  const offset = sydneyOffsetMs(probe)
  return new Date(Date.UTC(yr, mo - 1, da, h, min) - offset)
}

// ── Countdown formatting ──────────────────────────────────────────────────────

function formatCountdown(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}h ${mm}m ${ss}s` : `${mm}m ${ss}s`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns the next upcoming iqama.
 *
 * Priority:
 *  1. First future iqama from today's prayer list.
 *  2. Tomorrow's Fajr (passed in from PrayerData) — used after Isha has passed.
 *
 * Never returns null so the widget always shows a countdown.
 */
export function getNextIqama(
  prayers: Prayer[],
  tomorrowFajr: TomorrowFajr | null,
): NextIqama | null {
  const now = Date.now()

  // ── Today's remaining iqamas ──────────────────────────────────────────────
  const candidates = prayers
    .filter((p) => p.iqamaCountdownTime !== null)
    .flatMap((p) => {
      const date = parseDisplayTime(p.iqamaCountdownTime!)
      if (!date) return []
      const secondsUntil = Math.round((date.getTime() - now) / 1000)
      if (secondsUntil <= 0) return []
      return [{ prayer: p, secondsUntil, label: formatCountdown(secondsUntil) }]
    })
    .sort((a, b) => a.secondsUntil - b.secondsUntil)

  if (candidates.length > 0) return candidates[0]

  // ── Tomorrow's Fajr fallback ──────────────────────────────────────────────
  if (tomorrowFajr && tomorrowFajr.timeMs > now) {
    const secondsUntil = Math.round((tomorrowFajr.timeMs - now) / 1000)
    return {
      prayer: {
        name: 'Fajr',
        adhanTime: null,
        iqamaDisplay: tomorrowFajr.display,
        iqamaCountdownTime: tomorrowFajr.display,
      },
      secondsUntil,
      label: formatCountdown(secondsUntil),
    }
  }

  return null
}
