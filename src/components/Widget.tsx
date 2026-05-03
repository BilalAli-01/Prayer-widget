import { useState, useEffect, useCallback } from 'react'
import type { PrayerData } from '../types/prayer'
import type { NextIqama } from '../services/countdownService'
import { getNextIqama } from '../services/countdownService'
import { useDrag } from '../hooks/useDrag'
import PrayerTable from './PrayerTable'
import Settings from './Settings'
import styles from './Widget.module.css'

type Status = 'loading' | 'ready' | 'error'

function formatFetchedAt(epochMs: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(epochMs))
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function todaySydney(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default function Widget() {
  const { onPointerDown, onPointerMove, onPointerUp } = useDrag()

  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<PrayerData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [next, setNext] = useState<NextIqama | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.electronAPI.getIsCollapsed().then((v) => setIsCollapsed(v))
  }, [])

  const load = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(forceRefresh)
      if (!forceRefresh) setStatus('loading')
      const result: PrayerData = forceRefresh
        ? await window.electronAPI.refreshPrayerData()
        : await window.electronAPI.getPrayerData()
      setData(result)
      setStatus('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(false) }, [load])

  useEffect(() => {
    const id = setInterval(() => {
      if (data && data.date !== todaySydney()) load(false)
    }, 60_000)
    return () => clearInterval(id)
  }, [data, load])

  useEffect(() => {
    if (!data) return
    const tomorrowFajr = data.tomorrowFajr ?? null
    setNext(getNextIqama(data.prayers, tomorrowFajr))
    const id = setInterval(
      () => setNext(getNextIqama(data.prayers, tomorrowFajr)),
      1000,
    )
    return () => clearInterval(id)
  }, [data])

  const handleToggleCollapse = async () => {
    const newVal = !isCollapsed
    setIsCollapsed(newVal)
    await window.electronAPI.setCollapsed(newVal)
  }

  const handleOpenSettings = async () => {
    if (isCollapsed) {
      setIsCollapsed(false)
      await window.electronAPI.setCollapsed(false)
    }
    setShowSettings(true)
  }

  const handleSettingsSaved = (newData: PrayerData) => {
    setData(newData)
    setStatus('ready')
    setShowSettings(false)
  }

  const countdownClassName = [
    styles.countdown,
    next && next.secondsUntil <= 15 * 60 ? styles.countdownSoon : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={styles.shell}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className={styles.titleBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} />
          <span className={styles.titleText}>
            {showSettings ? 'Settings' : data ? formatDisplayDate(data.date) : 'Prayer Times'}
          </span>
        </div>
        <div className={styles.controls}>
          {data?.isOffline && !showSettings && (
            <span className={styles.offlineBadge} title="Using cached data; network unavailable">
              offline
            </span>
          )}
          {status === 'ready' && !isCollapsed && !showSettings && (
            <button
              className={`${styles.iconBtn} ${refreshing ? styles.spinning : ''}`}
              onClick={() => load(true)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Refresh"
              title="Refresh prayer times"
              disabled={refreshing}
            >
              &#8635;
            </button>
          )}
          {!showSettings && (
            <button
              className={styles.iconBtn}
              onClick={handleOpenSettings}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Settings"
              title="Settings"
            >
              &#9881;
            </button>
          )}
          {status === 'ready' && !showSettings && (
            <button
              className={styles.iconBtn}
              onClick={handleToggleCollapse}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '+' : '-'}
            </button>
          )}
          <button
            className={styles.closeBtn}
            onClick={() => window.electronAPI.closeWindow()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close"
            title="Hide to tray"
          >
            &times;
          </button>
        </div>
      </div>

      {showSettings && (
        <Settings
          onSave={handleSettingsSaved}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {!showSettings && status === 'loading' && (
        <div className={styles.centred}>
          <div className={styles.spinner} />
          <p className={styles.hint}>Fetching prayer times...</p>
        </div>
      )}

      {!showSettings && status === 'error' && (
        <div className={styles.centred}>
          <p className={styles.errorText}>Failed to load</p>
          <p className={styles.hint}>{errorMsg}</p>
          <button
            className={styles.retryBtn}
            onClick={() => load(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Retry
          </button>
        </div>
      )}

      {!showSettings && status === 'ready' && data && (
        <>
          <div className={styles.nextArea}>
            <div className={styles.kicker}>Next iqama</div>
            <div className={styles.nextRow}>
              <span className={styles.nextPrayer}>{next?.prayer.name ?? '--'}</span>
              <span className={styles.nextIqama}>{next?.prayer.iqamaCountdownTime ?? '--'}</span>
            </div>
            <div className={countdownClassName}>{next?.label ?? '--:--'}</div>
            <div className={styles.contextRow}>
              <span>Adhan {next?.prayer.adhanTime ?? '--'}</span>
              <span>Sydney</span>
            </div>
          </div>

          {!isCollapsed && (
            <>
              <div className={styles.divider} />
              <div className={styles.tableWrapper}>
                <PrayerTable
                  prayers={data.prayers}
                  nextPrayerName={next?.prayer.name ?? null}
                />
              </div>
              <div className={styles.lastUpdated}>
                Last updated {formatFetchedAt(data.fetchedAt)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
