import Store from 'electron-store'
import config from './config'

export interface UserSettings {
  goprayUrl: string
  latitude: number
  longitude: number
  notificationsEnabled: boolean
  notifyMinutes: number
}

const settingsStore = new Store<UserSettings>({
  name: 'user-settings',
  defaults: {
    goprayUrl: config.mosque.goprayUrl,
    latitude: config.coordinates.latitude,
    longitude: config.coordinates.longitude,
    notificationsEnabled: true,
    notifyMinutes: 15,
  },
})

export default settingsStore
