export interface Prayer {
  name: string
  adhanTime: string | null       // display format "5:18 PM"
  iqamaDisplay: string           // normalised text shown in table: "5:30 AM", "Just after Adhan"
  iqamaCountdownTime: string | null  // resolved time used for countdown "5:30 AM", null if unresolvable
}

export interface TomorrowFajr {
  display: string  // iqama time to show, e.g. "5:30 AM"
  timeMs: number   // UTC epoch ms — used for the countdown calculation
}

export interface PrayerData {
  prayers: Prayer[]
  date: string          // "YYYY-MM-DD" in Sydney timezone
  fetchedAt: number     // epoch ms
  isOffline: boolean
  tomorrowFajr: TomorrowFajr | null
}
