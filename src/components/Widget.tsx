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

  // Midnight auto-refresh
  useEffect(() => {
    const id = setInterval(() => {
      if (data && data.date !== todaySydney()) load(false)
    }, 60_000)
    return () => clearInterval(id)
  }, [data, load])

  // Countdown tick (absorbed from CountdownDisplay)
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

  return (
    <div
      className={styles.shell}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Title bar ─────────────────────────────────────────────────────── */}
      <div className={styles.titleBar}>
        <span className={styles.titleText}>Prayer Times</span>
        <div className={styles.controls}>
          {data?.isOffline && !showSettings && (
            <span className={styles.offlineBadge} title="Using cached data — network unavailable">
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
              ↻
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
              ⚙
            </button>
          )}
          {status === 'ready' && !showSettings && (
            <button
              className={styles.collapseBtn}
              onClick={handleToggleCollapse}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? '▾' : '▴'}
            </button>
          )}
          <button
            className={styles.closeBtn}
            onClick={() => window.electronAPI.closeWindow()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Settings ──────────────────────────────────────────────────────── */}
      {showSettings && (
        <Settings
          onSave={handleSettingsSaved}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {!showSettings && status === 'loading' && (
        <div className={styles.centred}>
          <div className={styles.spinner} />
          <p className={styles.hint}>Fetching prayer times…</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
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

      {/* ── Ready ─────────────────────────────────────────────────────────── */}
      {!showSettings && status === 'ready' && data && (
        <>
          {/* Next iqama summary — visible in both modes */}
          <div className={styles.nextArea}>
            <div className={styles.nextRow}>
              <span className={styles.nextPrayer}>{next?.prayer.name ?? '—'}</span>
              <span className={styles.nextIqama}>{next?.prayer.iqamaCountdownTime ?? '—'}</span>
            </div>
            <div className={styles.countdown}>{next?.label ?? '--:--'}</div>
          </div>

          {/* Full prayer table — expanded only */}
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
                ⏱ Last updated: {formatFetchedAt(data.fetchedAt)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
