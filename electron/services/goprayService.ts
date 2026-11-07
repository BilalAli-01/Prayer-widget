import { BrowserWindow } from 'electron'
import { parse } from 'node-html-parser'
import settingsStore from '../settingsStore'

const NAME_MAP: Record<string, string> = {
  fajr: 'Fajr', zuhr: 'Dhuhr', dhuhr: 'Dhuhr', dhur: 'Dhuhr', duhr: 'Dhuhr',
  asr: 'Asr', maghrib: 'Maghrib', esha: 'Isha', "isha'a": 'Isha', isha: 'Isha',
}

export interface IqamaEntry {
  name: string
  rawDisplay: string
}

export interface JummahTimes {
  first: string
  second: string | null
}

export interface GoPrayResult {
  iqama: IqamaEntry[]
  jummah: JummahTimes | null
}

/** Supports both the original WordPress page and the redesigned gopray.app page. */
export function parseGoPrayPage(html: string): GoPrayResult {
  const root = parse(html)
  const legacy = root.querySelector('.place-prayer-times')
  const table = legacy ?? root.querySelectorAll('table').find(t =>
    /iqamah?\s*time/i.test(t.querySelector('thead')?.text ?? ''),
  )
  if (!table) throw new Error('GoPray: prayer table not found')

  const iqama: IqamaEntry[] = []
  for (const row of table.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('th, td')
    if (cells.length < 2) continue
    const name = NAME_MAP[cells[0].text.trim().toLowerCase()]
    const rawDisplay = cells[1].text.replace(/\s+/g, ' ').trim()
    if (name && rawDisplay) iqama.push({ name, rawDisplay })
  }
  if (new Set(iqama.map(entry => entry.name)).size !== 5) {
    throw new Error('GoPray: expected all five prayer entries')
  }

  let jummahText = table.querySelector('tr.jummah td')?.text ?? ''
  if (!jummahText) {
    // The new site places Friday sessions outside the daily prayer table.
    const label = root.querySelectorAll('span, p').find(el => el.text.trim() === 'Friday khutbah')
    let block = label?.parentNode
    while (block && block !== root) {
      if (/\d{1,2}:\d{2}\s*[ap]m/i.test(block.text)) {
        jummahText = block.text
        break
      }
      block = block.parentNode
    }
  }
  const times = jummahText.match(/\d{1,2}:\d{2}\s*[ap]m/gi)?.map(time =>
    time.replace(/\s*([ap]m)$/i, ' $1').toUpperCase(),
  ) ?? []
  return { iqama, jummah: times.length ? { first: times[0], second: times[1] ?? null } : null }
}

function scrapeGoPray(url: string): Promise<GoPrayResult> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false, width: 1280, height: 900, skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false, contextIsolation: true, javascript: true,
        partition: 'persist:gopray',
      },
    })
    let done = false
    let extracting = false
    let lastError = 'prayer table not found'
    const finish = (error?: Error, result?: GoPrayResult) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      clearInterval(poll)
      win.destroy()
      if (error) reject(error)
      else resolve(result!)
    }
    const extract = async () => {
      if (done || extracting || win.webContents.isLoading()) return
      extracting = true
      try {
        const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
        const result = parseGoPrayPage(html)
        console.log(`[GoPray] Scraped ${result.iqama.length} iqama entries from ${win.webContents.getURL()}`)
        if (result.jummah) console.log('[GoPray] Jummah:', result.jummah)
        finish(undefined, result)
      } catch (err) {
        lastError = (err as Error).message
      } finally {
        extracting = false
      }
    }
    const timeout = setTimeout(() => finish(new Error(`GoPray timed out after 25s: ${lastError}`)), 25_000)
    // Keep checking through redirects and client-side rendering.
    const poll = setInterval(() => { void extract() }, 500)
    win.webContents.on('did-finish-load', () => { void extract() })
    win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) finish(new Error(`GoPray page failed to load: ${description} (${code})`))
    })
    void win.loadURL(url).catch((err: Error) => {
      if (!err.message.includes('ERR_ABORTED')) finish(err)
    })
  })
}

export async function fetchIqamaTimes(): Promise<GoPrayResult> {
  return scrapeGoPray(settingsStore.get('goprayUrl'))
}

export function parseIqamaTimes(html: string): IqamaEntry[] {
  return parseGoPrayPage(html).iqama
}
