/// <reference types="vite/client" />

import type { PrayerData } from './types/prayer'

interface ElectronAPI {
  // Window control
  dragWindow: (deltaX: number, deltaY: number) => void
  getPosition: () => Promise<{ x: number; y: number }>
  closeWindow: () => void
  getIsCollapsed: () => Promise<boolean>
  setCollapsed: (value: boolean) => Promise<void>
  // Prayer data
  getPrayerData: () => Promise<PrayerData>
  refreshPrayerData: () => Promise<PrayerData>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
