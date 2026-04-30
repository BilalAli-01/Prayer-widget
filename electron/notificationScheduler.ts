import { Notification } from 'electron'
import { getPrayerData } from './prayerDataManager'
import { parsePrayerTime, todayStrSydney, tomorrowStr } from './services/timeUtils'

const NOTIFY_WINDOW_LOW = 870   // 14m 30s
const NOTIFY_WINDOW_HIGH = 930  // 15m 30s

// Tracks "PrayerName:YYYY-MM-DD" keys that have already triggered a notification
const fired = new Set<string>()

let schedulerTimer: ReturnType<typeof setInterval> | null = null

function key(prayerName: string, date: string): string {
  return `${prayerName}:${date}`
}

async function check(): Promise<void> {
  if (!Notification.isSupported()) return

  let data
  try {
    data = await getPrayerData()
  } catch {
    return
  }

  const now = Date.now()
  const today = todayStrSydney()

  // Evict stale keys from previous days
  for (const k of fired) {
    if (!k.endsWith(`:${today}`)) fired.delete(k)
  }

  // Check today's prayers
  for (const prayer of data.prayers) {
    if (!prayer.iqamaCountdownTime) continue
    const k = key(prayer.name, today)
    if (fired.has(k)) continue

    let iqamaMs: number
    try {
      iqamaMs = parsePrayerTime(prayer.iqamaCountdownTime, today).getTime()
    } catch {
      continue
    }

    const secondsUntil = Math.round((iqamaMs - now) / 1000)
    if (secondsUntil >= NOTIFY_WINDOW_LOW && secondsUntil <= NOTIFY_WINDOW_HIGH) {
      new Notification({
        title: `${prayer.name} iqama in 15 minutes`,
        body: prayer.iqamaDisplay,
        timeoutType: 'never',
      }).show()
      fired.add(k)
    }
  }

  // Check tomorrow's Fajr (fires after Isha when it's the next upcoming prayer)
  if (data.tomorrowFajr) {
    const tomorrow = tomorrowStr(today)
    const k = key('Fajr', tomorrow)
    if (!fired.has(k)) {
      const secondsUntil = Math.round((data.tomorrowFajr.timeMs - now) / 1000)
      if (secondsUntil >= NOTIFY_WINDOW_LOW && secondsUntil <= NOTIFY_WINDOW_HIGH) {
        new Notification({
          title: 'Fajr iqama in 15 minutes',
          body: data.tomorrowFajr.display,
          timeoutType: 'never',
        }).show()
        fired.add(k)
      }
    }
  }
}

export function startNotificationScheduler(): void {
  if (schedulerTimer) return
  void check()
  schedulerTimer = setInterval(() => void check(), 30_000)
}

export function stopNotificationScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
