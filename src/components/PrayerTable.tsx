import type { Prayer } from '../types/prayer'
import styles from './PrayerTable.module.css'

interface Props {
  prayers: Prayer[]
  nextPrayerName: string | null
}

export default function PrayerTable({ prayers, nextPrayerName }: Props) {
  return (
    <table className={styles.table}>
      <thead>
        <tr className={styles.headerRow}>
          <th className={styles.thName}>Prayer</th>
          <th className={styles.thTime}>Adhan</th>
          <th className={styles.thTime}>Iqama</th>
        </tr>
      </thead>
      <tbody>
        {prayers.map((p) => (
          <tr
            key={p.name}
            className={`${styles.row} ${p.name === nextPrayerName ? styles.next : ''}`}
          >
            <td className={styles.name}>{p.name}</td>
            <td className={styles.time}>{p.adhanTime ?? '—'}</td>
            <td className={styles.time}>{p.iqamaDisplay}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
