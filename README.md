# Prayer Widget

A minimal always-on-top desktop widget that shows today's prayer times (adhan + iqama) and a live countdown to the next prayer. Built with Electron, React, and TypeScript.

Prayer times are fetched from two sources and merged:
- **Adhan times** — [Aladhan API](https://aladhan.com) (calculated)
- **Iqama times** — scraped from your mosque's [GoPray](https://gopray.com.au) page

The widget remembers its position on screen, collapses to a compact view, hides to the system tray when closed, and auto-starts with Windows.

---

## Configure for your mosque

Before running, open [electron/config.ts](electron/config.ts) and update the three settings:

```ts
const config = {
  mosque: {
    name: 'Your Mosque Name',
    goprayUrl: 'https://gopray.com.au/place/your-mosque-slug/',
  },

  coordinates: {
    latitude: 0.000,   // your mosque's latitude
    longitude: 0.000,  // your mosque's longitude
  },

  timezone: 'Australia/Sydney',  // your local timezone (IANA format)

  aladhan: {
    method: 3,   // calculation method — see https://aladhan.com/calculation-methods
    school: 0,   // Asr school: 0 = Shafi'i, 1 = Hanafi
  },
  // ...
}
```

If your mosque isn't on GoPray, iqama times will fall back to the `fallbackIqama` values you set in the same file.

> **Don't use GoPray?** You can skip the scraping entirely by hardcoding all iqama times in `fallbackIqama` and removing the GoPray fetch from `electron/prayerDataManager.ts`.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- npm (comes with Node)

---

## Getting started

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
npm run build
```

This produces an NSIS installer in the `release/` folder. Run the installer and the widget starts with Windows automatically.

### macOS

The build config in `package.json` currently only targets Windows. To build for macOS, add a `mac` entry to the `build` section:

```json
"mac": {
  "target": "dmg",
  "icon": "public/icon.png"
}
```

You'll also want to supply a `public/icon.png` (1024×1024) for a sharp Retina tray icon, since `.ico` files can look low-resolution on macOS displays.

Then run:

```bash
npm run build
```

> **Note:** Auto-start on login is not implemented for macOS (only Windows). The rest of the widget works normally.

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
  config.ts        ← edit this to configure your mosque/location
  main.ts          Window, tray, IPC
  prayerDataManager.ts  Fetch + cache logic
  notificationScheduler.ts  Prayer-time notifications
  services/
    aladhanService.ts   Adhan times from Aladhan API
    goprayService.ts    Iqama times scraped from GoPray
    prayerMergeService.ts  Merge both sources
    timeUtils.ts

src/               React renderer (UI)
  components/
    Widget.tsx     Main widget shell
    PrayerTable.tsx
    CountdownDisplay.tsx
  hooks/useDrag.ts
  services/countdownService.ts
  types/prayer.ts

public/            Static assets (icon)
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
