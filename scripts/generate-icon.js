// Generates public/icon.png (256x256) for electron-builder — no external deps
const { deflateSync } = require('zlib')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const SIZE = 256

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const c = crc32(Buffer.concat([tb, data]))
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length)
  const cb = Buffer.alloc(4); cb.writeUInt32BE(c)
  return Buffer.concat([lb, tb, data, cb])
}

// IHDR — 256×256 RGBA
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA

// Green circle on transparent background
const center = (SIZE - 1) / 2
const outerR = SIZE / 2 - 2
const innerR = outerR * 0.55  // hollow crescent-ish feel
const rows = []
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(1 + SIZE * 4)
  row[0] = 0
  for (let x = 0; x < SIZE; x++) {
    const dx = x - center, dy = y - center
    const d2 = dx * dx + dy * dy
    const inside = d2 <= outerR * outerR && d2 >= innerR * innerR
    row[1 + x * 4] = inside ? 30 : 0
    row[2 + x * 4] = inside ? 130 : 0
    row[3 + x * 4] = inside ? 80 : 0
    row[4 + x * 4] = inside ? 255 : 0
  }
  rows.push(row)
}

const raw = Buffer.concat(rows)
const idat = deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
writeFileSync(join(__dirname, '..', 'public', 'icon.png'), png)
console.log('Generated public/icon.png (256×256)')
