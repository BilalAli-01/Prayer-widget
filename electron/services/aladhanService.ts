import settingsStore from '../settingsStore'
import config from '../config'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AladhanTimings {
  Fajr: string
  Sunrise: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
  [key: string]: string
}

interface AladhanResponse {
  code: number
  status: string
  data: {
    timings: AladhanTimings
    date: { readable: string; timestamp: string }
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export async function fetchAdhanTimes(): Promise<AladhanTimings> {
  const latitude = settingsStore.get('latitude')
  const longitude = settingsStore.get('longitude')
  const { method, school } = config.aladhan

  // Pass the current Unix timestamp — Aladhan returns timings for that UTC day
  // adjusted to the given timezone, so today's Sydney prayers are returned correctly.
  const timestamp = Math.floor(Date.now() / 1000)

  const url =
    `https://api.aladhan.com/v1/timings/${timestamp}` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&method=${method}` +
    `&school=${school}` +
    `&timezonestring=${encodeURIComponent(config.timezone)}`

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  })

  if (!resp.ok) {
    throw new Error(`Aladhan API returned HTTP ${resp.status}`)
  }

  const json = (await resp.json()) as AladhanResponse

  if (json.code !== 200) {
    throw new Error(`Aladhan API error: ${json.status}`)
  }

  console.log('[Aladhan] Fetched timings for', json.data.date.readable)
  return json.data.timings
}
