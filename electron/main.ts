import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import Store from 'electron-store'
import {
  getPrayerData,
  fetchAndCache,
  startDailyRefresh,
  stopDailyRefresh,
} from './prayerDataManager'
import settingsStore from './settingsStore'
import type { UserSettings } from './settingsStore'
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from './notificationScheduler'

// ── Constants ─────────────────────────────────────────────────────────────────

const WIDGET_WIDTH_COLLAPSED = 260
const WIDGET_WIDTH_EXPANDED = 320
const WIDGET_HEIGHT_COLLAPSED = 128
const WIDGET_HEIGHT_EXPANDED = 340
const IS_DEV = process.env.NODE_ENV === 'development'

// ── Store ─────────────────────────────────────────────────────────────────────

interface WindowBounds {
  x: number
  y: number
}

interface StoreSchema {
  windowBounds: WindowBounds
  isCollapsed: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: { x: 100, y: 100 },
    isCollapsed: true,
  },
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// ── Tray icon ─────────────────────────────────────────────────────────────────

function getTrayIconPath(): string {
  // When installed (.exe), the icon is bundled as an extraResource
  if (app.isPackaged) return path.join(process.resourcesPath, 'icon.ico')
  // dev or npm start: load from the project's public folder
  return path.join(__dirname, '../../public/icon.ico')
}

function makeTrayIcon() {
  return nativeImage.createFromPath(getTrayIconPath())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentHeight(): number {
  return store.get('isCollapsed') ? WIDGET_HEIGHT_COLLAPSED : WIDGET_HEIGHT_EXPANDED
}

function currentWidth(): number {
  return store.get('isCollapsed') ? WIDGET_WIDTH_COLLAPSED : WIDGET_WIDTH_EXPANDED
}

function getValidatedPosition(): WindowBounds {
  const saved = store.get('windowBounds')
  const h = currentHeight()
  const displays = screen.getAllDisplays()

  const w = currentWidth()
  const isOnScreen = displays.some(({ workArea: { x, y, width, height } }) => (
    saved.x >= x &&
    saved.y >= y &&
    saved.x + w <= x + width &&
    saved.y + h <= y + height
  ))

  if (!isOnScreen) {
    const { workArea: { x, y, width } } = screen.getPrimaryDisplay()
    return { x: Math.floor(x + width - WIDGET_WIDTH_EXPANDED - 20), y: Math.floor(y + 20) }
  }

  return saved
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function showWindow() {
  if (!mainWindow) return
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Prayer Widget')

  const menu = Menu.buildFromTemplate([
    { label: 'Open Widget', click: showWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click() { isQuitting = true; app.quit() },
    },
  ])
  tray.setContextMenu(menu)

  tray.on('click', showWindow)
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  const pos = getValidatedPosition()
  const h = currentHeight()
  const w = currentWidth()

  mainWindow = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: w,
    height: h,
    minWidth: WIDGET_WIDTH_COLLAPSED,
    maxWidth: WIDGET_WIDTH_EXPANDED,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: true,

    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (IS_DEV) {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('moved', () => {
    if (!mainWindow) return
    const [x, y] = mainWindow.getPosition()
    store.set('windowBounds', { x, y })
  })

  // Hide to tray instead of closing, unless the app is actually quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Login item ────────────────────────────────────────────────────────────────

function configureLoginItem() {
  if (process.platform !== 'win32') return
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false, path: app.getPath('exe') })
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:drag', (_e, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + Math.round(deltaX), y + Math.round(deltaY))
})

ipcMain.handle('window:getPosition', () => {
  if (!mainWindow) return { x: 0, y: 0 }
  const [x, y] = mainWindow.getPosition()
  return { x, y }
})

// X button hides to tray; only Quit from the tray menu actually closes
ipcMain.on('window:close', () => mainWindow?.hide())

ipcMain.handle('window:getIsCollapsed', () => store.get('isCollapsed'))

ipcMain.handle('window:setCollapsed', (_e, collapsed: boolean) => {
  if (!mainWindow) return
  store.set('isCollapsed', collapsed)

  const [x, y] = mainWindow.getPosition()
  const newWidth = collapsed ? WIDGET_WIDTH_COLLAPSED : WIDGET_WIDTH_EXPANDED
  const newHeight = collapsed ? WIDGET_HEIGHT_COLLAPSED : WIDGET_HEIGHT_EXPANDED

  // setResizable must be toggled because setSize is blocked when resizable=false
  mainWindow.setResizable(true)
  mainWindow.setSize(newWidth, newHeight)
  mainWindow.setResizable(false)

  // Restore position — setSize can shift the window on some platforms
  mainWindow.setPosition(x, y)
})

ipcMain.handle('prayer:getData', () => getPrayerData())
ipcMain.handle('prayer:refresh', () => fetchAndCache())

ipcMain.handle('settings:get', () => settingsStore.store)
ipcMain.handle('settings:save', async (_e, settings: UserSettings) => {
  settingsStore.set('goprayUrl', settings.goprayUrl)
  settingsStore.set('latitude', settings.latitude)
  settingsStore.set('longitude', settings.longitude)
  settingsStore.set('notificationsEnabled', settings.notificationsEnabled)
  settingsStore.set('notifyMinutes', settings.notifyMinutes)
  settingsStore.set('jummahSession', settings.jummahSession)
  return fetchAndCache()
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAppUserModelId('com.prayerwidget.app')
  createWindow()
  createTray()
  configureLoginItem()
  startDailyRefresh()
  startNotificationScheduler()
  getPrayerData().catch((err: Error) =>
    console.error('[Main] Initial prayer fetch failed:', err.message),
  )
})

// App stays alive in the tray; only quit via tray menu
app.on('window-all-closed', () => {
  if (isQuitting) {
    stopDailyRefresh()
    stopNotificationScheduler()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopDailyRefresh()
  stopNotificationScheduler()
  tray?.destroy()
  tray = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
