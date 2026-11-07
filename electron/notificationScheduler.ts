import { Notification } from 'electron'
import { getPrayerData } from './prayerDataManager'
import { parsePrayerTime, todayStrSydney, tomorrowStr } from './services/timeUtils'
import settingsStore from './settingsStore'

// Tracks "PrayerName:YYYY-MM-DD" keys that have already triggered a notification
const fired = new Set<string>()

let schedulerTimer: ReturnType<typeof setInterval> | null = null

function showPrayerNotification(title: string, body: string): void {
  const persistent = settingsStore.get('persistentNotifications')
  const notification = new Notification({ title, body, timeoutType: persistent ? 'never' : 'default' })
  let dismissTimer: ReturnType<typeof setTimeout> | undefined
  if (!persistent) {
    notification.once('show', () => {
      dismissTimer = setTimeout(() => notification.close(), 10_000)
    })
  }
  const clearDismissTimer = () => clearTimeout(dismissTimer)
  notification.once('close', clearDismissTimer)
  notification.once('failed', clearDismissTimer)
  notification.show()
}

function key(prayerName: string, date: string): string {
  return `${prayerName}:${date}`
}

async function check(): Promise<void> {
  if (!Notification.isSupported()) return
  if (!settingsStore.get('notificationsEnabled')) return

  let data
  try {
    data = await getPrayerData()
  } catch {
    return
  }

  const notifyMinutes = settingsStore.get('notifyMinutes')
  const windowLow = notifyMinutes * 60 - 30
  const windowHigh = notifyMinutes * 60 + 30
  const label = `${notifyMinutes} minute${notifyMinutes === 1 ? '' : 's'}`

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
    if (secondsUntil >= windowLow && secondsUntil <= windowHigh) {
      showPrayerNotification(`${prayer.name} iqama in ${label}`, prayer.iqamaDisplay)
      fired.add(k)
    }
  }

  // Check tomorrow's Fajr (fires after Isha when it's the next upcoming prayer)
  if (data.tomorrowFajr) {
    const tomorrow = tomorrowStr(today)
    const k = key('Fajr', tomorrow)
    if (!fired.has(k)) {
      const secondsUntil = Math.round((data.tomorrowFajr.timeMs - now) / 1000)
      if (secondsUntil >= windowLow && secondsUntil <= windowHigh) {
        showPrayerNotification(`Fajr iqama in ${label}`, data.tomorrowFajr.display)
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
