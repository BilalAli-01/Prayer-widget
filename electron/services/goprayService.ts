import { BrowserWindow } from 'electron'
import { parse } from 'node-html-parser'
import settingsStore from '../settingsStore'

// ── Prayer name normalisation ─────────────────────────────────────────────────
const NAME_MAP: Record<string, string> = {
  fajr: 'Fajr',
  zuhr: 'Dhuhr',
  dhuhr: 'Dhuhr',
  dhur: 'Dhuhr',
  duhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  esha: 'Isha',
  "isha'a": 'Isha',
  isha: 'Isha',
}

export interface IqamaEntry {
  name: string       // canonical: "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"
  rawDisplay: string // e.g. "5:30 am", "Just after athaan"
}

// Raw shape returned by the in-page JS extraction
interface RawRow {
  name: string
  display: string
}

// ── Hidden-window scraper ─────────────────────────────────────────────────────
// Loads the GoPray page in a real (hidden) Chromium window so that any
// JavaScript-based security challenges (cookie-setting scripts, bot-detection
// redirects, etc.) execute exactly as they would in a normal browser visit.
// HTTP-only clients (fetch / electron.net) cannot pass those challenges.

function scrapeGoPray(url: string): Promise<IqamaEntry[]> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: true,
        // Persistent partition keeps cookies across calls, so the session
        // cookie set on first visit is reused on the next daily fetch.
        partition: 'persist:gopray',
      },
    })

    let done = false

    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { win.destroy() } catch { /* already destroyed */ }
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('GoPray page load timed out after 25s')))
    }, 25_000)

    // did-finish-load fires after the page (and its JS) has fully executed,
    // so any cookie-setting scripts have already run at this point.
    win.webContents.once('did-finish-load', () => {
      // Extract the iqama table directly in the page's DOM context.
      // Using the browser's native querySelector is more robust than parsing
      // the serialised HTML with a third-party library.
      win.webContents
        .executeJavaScript(`
          (() => {
            const container = document.querySelector('.place-prayer-times')
            if (!container) return null
            const rows = Array.from(container.querySelectorAll('table tr'))
            return rows
              .filter(r => !r.className.includes('jummah') && !r.className.includes('tahajjud'))
              .map(r => {
                const th = r.querySelector('th')
                const td = r.querySelector('td')
                if (!th || !td) return null
                return {
                  name: th.textContent.trim(),
                  display: td.textContent.replace(/\\s+/g, ' ').trim()
                }
              })
              .filter(Boolean)
          })()
        `)
        .then((rows: RawRow[] | null) => {
          finish(() => {
            if (!rows || rows.length === 0) {
              reject(new Error('GoPray: .place-prayer-times not found or empty after page load'))
              return
            }

            const entries: IqamaEntry[] = []
            for (const row of rows) {
              const canonical = NAME_MAP[row.name.toLowerCase()]
              if (canonical && row.display) {
                entries.push({ name: canonical, rawDisplay: row.display })
              }
            }

            if (entries.length === 0) {
              reject(new Error('GoPray: parsed zero known prayer entries'))
              return
            }

            console.log(`[GoPray] Scraped ${entries.length} iqama entries via BrowserWindow`)
            resolve(entries)
          })
        })
        .catch((err: Error) => finish(() => reject(err)))
    })

    // ERR_ABORTED (-3) fires on JS-triggered navigations/redirects — safe to ignore.
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      if (code === -3) return
      finish(() => reject(new Error(`GoPray page failed to load: ${desc} (${code})`)))
    })

    win.loadURL(url)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchIqamaTimes(): Promise<IqamaEntry[]> {
  return scrapeGoPray(settingsStore.get('goprayUrl'))
}

// parseIqamaTimes kept for offline unit-testing with raw HTML.
export function parseIqamaTimes(html: string): IqamaEntry[] {
  const root = parse(html)
  const container = root.querySelector('.place-prayer-times')
  if (!container) throw new Error('Could not find .place-prayer-times')

  const rows = container.querySelectorAll('table tr')
  const entries: IqamaEntry[] = []

  for (const row of rows) {
    const cls = row.getAttribute('class') ?? ''
    if (cls.includes('jummah') || cls.includes('tahajjud')) continue
    const th = row.querySelector('th')
    const td = row.querySelector('td')
    if (!th || !td) continue
    const canonical = NAME_MAP[th.text.trim().toLowerCase()]
    if (!canonical) continue
    const rawDisplay = td.text.replace(/\s+/g, ' ').trim()
    if (rawDisplay) entries.push({ name: canonical, rawDisplay })
  }

  return entries
}
