/**
 * Erzeugt die PNG-Symbole für Homescreen und Manifest.
 *
 * Bewusst ohne Bildbibliothek: Das Motiv besteht aus wenigen geometrischen
 * Formen, die sich über Abstandsfunktionen sauber und kantengeglättet rastern
 * lassen. Das spart eine schwergewichtige Abhängigkeit, die sonst nur für vier
 * Dateien im Projekt läge.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/* --- Formen als vorzeichenbehaftete Abstandsfunktionen -------------------- */

/** Abstand zu einem abgerundeten Quadrat, negativ innerhalb. */
function sdRoundedBox(px, py, cx, cy, half, radius) {
  const qx = Math.abs(px - cx) - (half - radius)
  const qy = Math.abs(py - cy) - (half - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

/** Abstand zur Strecke a→b. */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2))
  return Math.hypot(wx - vx * t, wy - vy * t)
}

/**
 * Abstand zu einem Kreisbogen um (cx,cy), gezeichnet von `from` bis `to`
 * (Bogenmaß, im Uhrzeigersinn wachsend). Außerhalb des Winkelbereichs zählt der
 * Abstand zum nächsten Bogenende, damit die runden Kappen entstehen.
 */
function sdArc(px, py, cx, cy, radius, from, to) {
  const dx = px - cx
  const dy = py - cy
  let angle = Math.atan2(dy, dx)
  const twoPi = Math.PI * 2
  // Winkel in das Fenster [from, from + 2π) heben, damit der Vergleich stimmt.
  while (angle < from) angle += twoPi
  if (angle <= to) return Math.abs(Math.hypot(dx, dy) - radius)
  const endA = [cx + radius * Math.cos(from), cy + radius * Math.sin(from)]
  const endB = [cx + radius * Math.cos(to), cy + radius * Math.sin(to)]
  return Math.min(Math.hypot(px - endA[0], py - endA[1]), Math.hypot(px - endB[0], py - endB[1]))
}

/** Deckung einer Form an einem Pixel, weich über eine Pixelbreite. */
function coverage(distance) {
  return Math.min(1, Math.max(0, 0.5 - distance))
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/* --- PNG schreiben -------------------------------------------------------- */

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, crc])
}

/** RGBA-Rohdaten als PNG kodieren. */
function encodePng(width, height, rgba) {
  const stride = width * 4
  // Jede Zeile bekommt ihr Filter-Byte 0 vorangestellt.
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 6 // Farbtyp RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* --- Motiv ---------------------------------------------------------------- */

const TOP = [61, 123, 247]
const BOTTOM = [124, 92, 240]
const WHITE = [255, 255, 255]

/**
 * @param size   Kantenlänge in Pixeln
 * @param masked true für das maskierbare Symbol: randlose Fläche und kleineres
 *               Motiv, damit Android jede Maskenform ausstanzen kann.
 */
function render(size, masked) {
  const rgba = Buffer.alloc(size * size * 4)
  const s = size / 512 // Maßstab, das Motiv ist für 512 px entworfen
  const c = size / 2
  const scale = masked ? 0.66 : 1 // Motiv in der Sicherheitszone halten
  const stroke = 17 * s * scale // halbe Strichstärke
  const radius = 132 * s * scale
  const boxHalf = masked ? size : 256 * s
  const boxRadius = masked ? 0 : 114 * s

  // Häkchen, Maße aus dem SVG übernommen und mitskaliert.
  const pt = (x, y) => [c + (x - 256) * s * scale, c + (y - 256) * s * scale]
  const [ax, ay] = pt(196, 262)
  const [bx, by] = pt(236, 304)
  const [dx2, dy2] = pt(320, 208)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5

      const bg = coverage(sdRoundedBox(px, py, c, c, boxHalf, boxRadius))
      if (bg <= 0) continue

      let color = mix(TOP, BOTTOM, y / size)

      // Ring: 270°, Lücke unten rechts – wie im SVG.
      const ring = coverage(
        sdArc(px, py, c, c, radius, (135 * Math.PI) / 180, (135 * Math.PI) / 180 + Math.PI * 1.5) -
          stroke,
      )
      const tick = coverage(
        Math.min(sdSegment(px, py, ax, ay, bx, by), sdSegment(px, py, bx, by, dx2, dy2)) - stroke,
      )
      const mark = Math.max(ring * 0.95, tick)
      if (mark > 0) color = mix(color, WHITE, mark)

      const i = (y * size + x) * 4
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = Math.round(bg * 255)
    }
  }
  return encodePng(size, size, rgba)
}

for (const [name, size, masked] of [
  ['icon-180.png', 180, false], // apple-touch-icon
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable.png', 512, true],
]) {
  writeFileSync(join(OUT, name), render(size, masked))
  console.log('geschrieben:', name)
}
