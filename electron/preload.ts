import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window control ──────────────────────────────────────────────────────────
  dragWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.send('window:drag', { deltaX, deltaY }),

  getPosition: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke('window:getPosition'),

  closeWindow: () => ipcRenderer.send('window:close'),

  getIsCollapsed: (): Promise<boolean> =>
    ipcRenderer.invoke('window:getIsCollapsed'),

  setCollapsed: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('window:setCollapsed', value),

  // ── Prayer data ─────────────────────────────────────────────────────────────
  getPrayerData: () => ipcRenderer.invoke('prayer:getData'),
  refreshPrayerData: () => ipcRenderer.invoke('prayer:refresh'),

  // ── Settings ─────────────────────────────────────────────────────────────────
  getSettings: (): Promise<{ goprayUrl: string; latitude: number; longitude: number; notificationsEnabled: boolean; notifyMinutes: number }> =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: { goprayUrl: string; latitude: number; longitude: number; notificationsEnabled: boolean; notifyMinutes: number }) =>
    ipcRenderer.invoke('settings:save', settings),
})
