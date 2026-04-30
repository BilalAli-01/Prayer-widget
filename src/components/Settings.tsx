import { useState, useEffect } from 'react'
import type { PrayerData } from '../types/prayer'
import styles from './Settings.module.css'

interface Props {
  onSave: (data: PrayerData) => void
  onCancel: () => void
}

export default function Settings({ onSave, onCancel }: Props) {
  const [goprayUrl, setGoprayUrl] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifyMinutes, setNotifyMinutes] = useState('15')
  const [jummahSession, setJummahSession] = useState<'first' | 'second'>('first')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setGoprayUrl(s.goprayUrl)
      setLatitude(String(s.latitude))
      setLongitude(String(s.longitude))
      setNotificationsEnabled(s.notificationsEnabled)
      setNotifyMinutes(String(s.notifyMinutes))
      setJummahSession(s.jummahSession)
    })
  }, [])

  const handleSave = async () => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    const minutes = parseInt(notifyMinutes, 10)
    if (!goprayUrl.trim()) return setError('GoPray URL is required')
    if (isNaN(lat) || lat < -90 || lat > 90) return setError('Latitude must be between -90 and 90')
    if (isNaN(lng) || lng < -180 || lng > 180) return setError('Longitude must be between -180 and 180')
    if (notificationsEnabled && (isNaN(minutes) || minutes < 1 || minutes > 60))
      return setError('Notify minutes must be between 1 and 60')

    setSaving(true)
    setError('')
    try {
      const data = await window.electronAPI.saveSettings({
        goprayUrl: goprayUrl.trim(),
        latitude: lat,
        longitude: lng,
        notificationsEnabled,
        notifyMinutes: minutes,
        jummahSession,
      })
      onSave(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
      setSaving(false)
    }
  }

  return (
    <div className={styles.panel} onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.field}>
        <label className={styles.label}>GoPray URL</label>
        <input
          className={styles.input}
          type="url"
          value={goprayUrl}
          onChange={(e) => setGoprayUrl(e.target.value)}
          placeholder="https://gopray.com.au/place/your-mosque/"
          spellCheck={false}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Latitude</label>
          <input
            className={styles.input}
            type="number"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="-33.774"
            step="any"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Longitude</label>
          <input
            className={styles.input}
            type="number"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="150.843"
            step="any"
          />
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.row} style={{ alignItems: 'center' }}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
          />
          Iqama notifications
        </label>
        {notificationsEnabled && (
          <div className={styles.minutesRow}>
            <input
              className={`${styles.input} ${styles.minutesInput}`}
              type="number"
              value={notifyMinutes}
              onChange={(e) => setNotifyMinutes(e.target.value)}
              min={1}
              max={60}
            />
            <span className={styles.minutesLabel}>min before</span>
          </div>
        )}
      </div>
      <div className={styles.divider} />
      <div className={styles.field}>
        <label className={styles.label}>Jummah Session</label>
        <select
          className={styles.input}
          value={jummahSession}
          onChange={(e) => setJummahSession(e.target.value as 'first' | 'second')}
        >
          <option value="first">First Jummah</option>
          <option value="second">Second Jummah</option>
        </select>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saving && <p className={styles.hint}>Fetching prayer times for new mosque…</p>}
    </div>
  )
}
