import Store from 'electron-store'
import config from './config'

export interface UserSettings {
  goprayUrl: string
  latitude: number
  longitude: number
  notificationsEnabled: boolean
  persistentNotifications: boolean
  notifyMinutes: number
  jummahSession: 'first' | 'second'
}

const settingsStore = new Store<UserSettings>({
  name: 'user-settings',
  defaults: {
    goprayUrl: config.mosque.goprayUrl,
    latitude: config.coordinates.latitude,
    longitude: config.coordinates.longitude,
    notificationsEnabled: true,
    persistentNotifications: false,
    notifyMinutes: 15,
    jummahSession: 'first',
  },
})

export default settingsStore
