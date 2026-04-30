const TZ = 'Australia/Sydney'

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in Sydney timezone. */
export function todayStrSydney(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Returns tomorrow's date as "YYYY-MM-DD" given today's Sydney date string.
 * Uses UTC arithmetic so month/year rollovers are handled correctly.
 */
export function tomorrowStr(todaySydney: string): string {
  const [yr, mo, da] = todaySydney.split('-').map(Number)
  const d = new Date(Date.UTC(yr, mo - 1, da + 1))
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** How many milliseconds Sydney is ahead of UTC at a given UTC instant. */
function sydneyOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
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

// ── Time parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a prayer time string ("5:30 am", "12:45 pm", "04:26") as a Sydney
 * local time on the given Sydney date ("YYYY-MM-DD"), returning a UTC Date.
 */
export function parsePrayerTime(timeStr: string, sydneyDate: string): Date {
  let h: number, m: number
  const lo = timeStr.trim().toLowerCase()
  const m12 = lo.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/)
  const m24 = lo.match(/^(\d{1,2}):(\d{2})$/)

  if (m12) {
    h = Number(m12[1])
    m = Number(m12[2])
    if (m12[3] === 'pm' && h !== 12) h += 12
    if (m12[3] === 'am' && h === 12) h = 0
  } else if (m24) {
    h = Number(m24[1])
    m = Number(m24[2])
  } else {
    throw new Error(`Cannot parse prayer time: "${timeStr}"`)
  }

  const [yr, mo, da] = sydneyDate.split('-').map(Number)
  // Use a probe date to find the offset, then convert Sydney local → UTC
  const probe = new Date(Date.UTC(yr, mo - 1, da, h, m))
  const offset = sydneyOffsetMs(probe)
  return new Date(Date.UTC(yr, mo - 1, da, h, m) - offset)
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Converts Aladhan's 24h "04:26" to display "4:26 AM". */
export function formatAdhan24(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = Number(hStr)
  const min = Number(mStr)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

/** Formats a Date as Sydney local time in "h:mm AM/PM" (e.g. "5:30 AM"). */
export function formatDateSydney(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/** Adds `mins` minutes to a Date. */
export function addMins(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000)
}

/**
 * Normalises GoPray iqama display strings:
 *   "5:30 am"           → "5:30 AM"
 *   "Just after athaan" → "Just after Adhan"
 *   "10 mins after adhan" → "10 min after Adhan"
 */
export function normaliseIqamaDisplay(raw: string): string {
  const lo = raw.toLowerCase().trim()

  if (/^\d{1,2}:\d{2}\s*(am|pm)$/.test(lo)) {
    return raw.trim().replace(/\bam\b/i, 'AM').replace(/\bpm\b/i, 'PM')
  }

  if (/just after a(dha|tha)a?n/i.test(lo)) {
    return 'Just after Adhan'
  }

  const minsMatch = lo.match(/^(\d+)\s*min/)
  if (minsMatch && /after\s+a(dha|tha)a?n/i.test(lo)) {
    return `${minsMatch[1]} min after Adhan`
  }

  return raw
}
