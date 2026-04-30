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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setGoprayUrl(s.goprayUrl)
      setLatitude(String(s.latitude))
      setLongitude(String(s.longitude))
    })
  }, [])

  const handleSave = async () => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (!goprayUrl.trim()) return setError('GoPray URL is required')
    if (isNaN(lat) || lat < -90 || lat > 90) return setError('Latitude must be between -90 and 90')
    if (isNaN(lng) || lng < -180 || lng > 180) return setError('Longitude must be between -180 and 180')

    setSaving(true)
    setError('')
    try {
      const data = await window.electronAPI.saveSettings({
        goprayUrl: goprayUrl.trim(),
        latitude: lat,
        longitude: lng,
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
