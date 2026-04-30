import { useState, useEffect } from 'react'
import type { Prayer, TomorrowFajr } from '../types/prayer'
import { getNextIqama } from '../services/countdownService'
import styles from './CountdownDisplay.module.css'

interface Props {
  prayers: Prayer[]
  tomorrowFajr: TomorrowFajr | null
}

export default function CountdownDisplay({ prayers, tomorrowFajr }: Props) {
  const [next, setNext] = useState(() => getNextIqama(prayers, tomorrowFajr))

  useEffect(() => {
    setNext(getNextIqama(prayers, tomorrowFajr))
    const id = setInterval(() => setNext(getNextIqama(prayers, tomorrowFajr)), 1000)
    return () => clearInterval(id)
  }, [prayers, tomorrowFajr])

  if (!next) return <div className={styles.root} />

  return (
    <div className={styles.root}>
      <div className={styles.label}>Next Iqama</div>
      <div className={styles.prayerRow}>
        <span className={styles.prayerName}>{next.prayer.name}</span>
        <span className={styles.iqamaTime}>{next.prayer.iqamaCountdownTime}</span>
      </div>
      <div className={styles.countdown}>{next.label}</div>
    </div>
  )
}
