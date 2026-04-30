// ─── Change these to point at a different mosque / location ──────────────────
const config = {
  mosque: {
    name: 'Rooty Hill Mosque',
    goprayUrl: 'https://gopray.com.au/place/rooty-hill-mosque/',
  },

  coordinates: {
    latitude: -33.774,
    longitude: 150.843,
  },

  timezone: 'Australia/Sydney' as const,

  aladhan: {
    // Calculation method: 3 = Muslim World League
    // See https://aladhan.com/calculation-methods for alternatives
    method: 3,
    // Asr school: 0 = Shafi'i, 1 = Hanafi
    school: 0,
  },

  prayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const,

  // ── Fallback iqama times ────────────────────────────────────────────────────
  // Used when GoPray scraping fails AND there is no cached data.
  // Update these whenever the mosque changes their schedule.
  // Values follow the same rules as GoPray:
  //   fixed time   → "5:30 AM"
  //   after adhan  → "Just after Adhan"
  //   offset       → "10 min after Adhan"
  fallbackIqama: {
    Fajr: '5:30 AM',
    Dhuhr: '12:45 PM',
    Asr: '4:15 PM',
    Maghrib: 'Just after Adhan',
    Isha: '7:30 PM',
  } as Record<string, string>,
}

export type PrayerName = (typeof config.prayers)[number]

export default config
