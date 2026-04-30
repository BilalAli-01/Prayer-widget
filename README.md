# Prayer Widget

A minimal always-on-top desktop widget that shows today's prayer times (adhan + iqama) and a live countdown to the next prayer. Built with Electron, React, and TypeScript.

Prayer times are fetched from two sources and merged:
- **Adhan times** — [Aladhan API](https://aladhan.com) (calculated)
- **Iqama times** — scraped from your mosque's [GoPray](https://gopray.com.au) page

The widget remembers its position on screen, collapses to a compact view, hides to the system tray when closed, and auto-starts with Windows.

---

## Installation

Download `Prayer Widget Setup 1.0.0.exe` from the [releases page](https://github.com/BilalAli-01/Prayer-widget/releases) (or the `release/` folder if building from source), run it, and the widget will start automatically with Windows.

---

## Configure for your mosque

No code editing required. Hover over the widget, click the **⚙** gear icon, and fill in:

| Field | Description |
|---|---|
| **GoPray URL** | Your mosque's GoPray page, e.g. `https://gopray.com.au/place/your-mosque/` |
| **Latitude** | Your mosque's latitude (find it by right-clicking on Google Maps) |
| **Longitude** | Your mosque's longitude |
| **Jummah Session** | For mosques with two Jummah sessions — select **First Jummah** or **Second Jummah** (default: First) |

Click **Save** and the widget immediately fetches prayer times for your mosque.

> Settings are stored locally and persist across restarts.

If your mosque isn't on GoPray, iqama times will fall back to the hardcoded values in [electron/config.ts](electron/config.ts).

---

## Jummah on Fridays

On Fridays the widget automatically:

- Replaces **Dhuhr** with **Jummah** in the prayer list
- Shows the **Jummah Khutbah time** (from GoPray) as the iqama time
- Keeps the regular Dhuhr adhan time from the Aladhan API

If your mosque runs two Jummah sessions (e.g. 1:00 PM and 1:30 PM), open the **⚙** settings panel and set **Jummah Session** to whichever one you attend. The setting defaults to the first session.

---

## Iqama notifications

The widget sends a desktop notification before each iqama. Configure this in the **⚙** settings panel:

- **Enable/disable** notifications with the checkbox
- **Change the lead time** — enter how many minutes before iqama to notify (1–60, default 15)

Notifications stay on screen until dismissed.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- npm (comes with Node)

---

## Getting started (development)

```bash
# 1. Clone the repo
git clone https://github.com/BilalAli-01/Prayer-widget.git
cd Prayer-widget

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev
```

The widget will appear on screen. DevTools open automatically in dev mode.

---

## Build a distributable

### Windows

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build
```

This produces an NSIS installer at `release/Prayer Widget Setup 1.0.0.exe`. Run it and the widget starts with Windows automatically.

> The `CSC_IDENTITY_AUTO_DISCOVERY=false` flag skips code signing (no certificate needed for personal use). You also need **Developer Mode** enabled in Windows Settings → System → For developers, otherwise the build will fail on a symlink permission error.

### macOS

The build config in `package.json` currently only targets Windows. To build for macOS, add a `mac` entry to the `build` section:

```json
"mac": {
  "target": "dmg",
  "icon": "public/icon.png"
}
```

You'll also want to supply a `public/icon.png` (1024×1024) for a sharp Retina tray icon, since `.ico` files can look low-resolution on macOS displays.

> **Note:** Auto-start on login is not implemented for macOS. The rest of the widget works normally.

### Linux

Add a `linux` entry similarly:

```json
"linux": {
  "target": "AppImage"
}
```

---

## Project structure

```
electron/          Electron main process
  config.ts        Static defaults (mosque, coordinates, fallback iqama times)
  settingsStore.ts User settings persisted via electron-store
  main.ts          Window, tray, IPC handlers
  preload.ts       Context bridge (renderer ↔ main)
  prayerDataManager.ts  Fetch + cache logic
  notificationScheduler.ts  Iqama notifications
  services/
    aladhanService.ts   Adhan times from Aladhan API
    goprayService.ts    Iqama times scraped from GoPray
    prayerMergeService.ts  Merge both sources
    timeUtils.ts

src/               React renderer (UI)
  components/
    Widget.tsx     Main widget shell
    PrayerTable.tsx
    Settings.tsx   Settings panel (mosque config + notifications)
  hooks/useDrag.ts
  services/countdownService.ts
  types/prayer.ts

public/            Static assets (icon.ico)
```

---

## Tech stack

- [Electron](https://www.electronjs.org) — desktop shell
- [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — bundler
- [electron-builder](https://www.electron.build) — packaging
- [electron-store](https://github.com/sindresorhus/electron-store) — persistent settings
- [Aladhan API](https://aladhan.com/prayer-times-api) — calculated adhan times
- [GoPray](https://gopray.com.au) — mosque iqama times (scraping)

---

## License

MIT
