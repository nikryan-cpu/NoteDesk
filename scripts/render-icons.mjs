// Renders the NoteDesk logo (build/logo.svg, build/tray.svg) into every icon asset the app
// and the installer need. Run with `npm run icons`.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const buildDir = join(root, 'build')
const resourcesDir = join(root, 'resources')

// ---------------------------------------------------------------- geometry

// Superellipse (squircle) outline, sampled into a polygon. n≈4.5 sits between a rounded
// rect and a circle -- the "continuous corner" look used by modern app tiles.
function squirclePath(cx, cy, r, n = 4.5, steps = 180) {
  const pts = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * r
    const y = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * r
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

// Horizontal pill from (x, y), width w, 4 units tall.
function pill(x, y, w) {
  return `M${x + 2},${y}L${x + w - 2},${y}A2,2 0 0 1 ${x + w - 2},${y + 4}L${x + 2},${y + 4}A2,2 0 0 1 ${x + 2},${y}Z`
}

// The glyph: a notepad with a bookmark ribbon and (at larger sizes) ruled lines cut through it
// (fill-rule evenodd), resting above a separate desk line. Drawn on a 100x100 grid.
function glyphMarkup(glyphColor, lines = true) {
  const page =
    'M31,15L69,15A8,8 0 0 1 77,23L77,61A8,8 0 0 1 69,69L31,69A8,8 0 0 1 23,61L23,23A8,8 0 0 1 31,15Z' +
    'M53,15L63,15L63,37L58,45L53,37Z' +
    (lines ? pill(31, 29, 16) + pill(31, 49, 38) + pill(31, 57, 26) : '')
  const desk = 'M18,76L82,76A3,3 0 0 1 85,79A3,3 0 0 1 82,82L18,82A3,3 0 0 1 15,79A3,3 0 0 1 18,76Z'
  return `<path d="${page}" fill="${glyphColor}" fill-rule="evenodd"/><path d="${desk}" fill="${glyphColor}"/>`
}

// ---------------------------------------------------------------- sources

const TILE_SIZE = 1024
const TILE_R = 412 // ~10% transparent margin, matches macOS-style padded tiles
const GLYPH_SCALE = 6.4
const GLYPH_OFFSET = TILE_SIZE / 2 - 50 * GLYPH_SCALE

const tileSvg = (lines) => `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}">
  <defs>
    <linearGradient id="tile" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="55%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <path d="${squirclePath(TILE_SIZE / 2, TILE_SIZE / 2, TILE_R)}" fill="url(#tile)"/>
  <g transform="translate(${GLYPH_OFFSET.toFixed(2)},${GLYPH_OFFSET.toFixed(2)}) scale(${GLYPH_SCALE})">
    ${glyphMarkup('#ffffff', lines)}
  </g>
</svg>`
const logoSvg = tileSvg(true)
// Ruled lines turn into mush below ~48px, so small sizes get the plain notepad.
const logoFor = (size) => (size >= 48 ? logoSvg : tileSvg(false))

const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  ${glyphMarkup('#000000', false)}
</svg>`

mkdirSync(buildDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })
writeFileSync(join(buildDir, 'logo.svg'), logoSvg)
writeFileSync(join(buildDir, 'tray.svg'), traySvg)

// The shell UI shows the same mark (onboarding, Quick Ask header).
const assetsDir = join(root, 'src/renderer/src/assets')
mkdirSync(assetsDir, { recursive: true })
writeFileSync(join(assetsDir, 'logo.svg'), logoSvg)
writeFileSync(join(assetsDir, 'logo-small.svg'), logoFor(32))

// ---------------------------------------------------------------- rendering

function renderPng(svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return resvg.render().asPng()
}

// Minimal PNG-compressed ICO writer: ICONDIR + ICONDIRENTRY[] + raw PNG payloads.
function buildIco(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)

  const entries = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  const chunks = [header]
  for (let i = 0; i < count; i++) {
    const { size, png } = images[i]
    const entry = entries.subarray(i * 16, i * 16 + 16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8) // size of PNG data
    entry.writeUInt32LE(offset, 12) // offset of PNG data
    offset += png.length
    chunks.push(png)
  }
  chunks.splice(1, 0, entries)
  return Buffer.concat(chunks)
}

function writeIco(path, sizes) {
  const images = sizes.map((size) => ({ size, png: renderPng(logoFor(size), size) }))
  writeFileSync(path, buildIco(images))
}

// build/ -- electron-builder packaging sources
writeFileSync(join(buildDir, 'icon.png'), renderPng(logoSvg, 1024))
writeIco(join(buildDir, 'icon.ico'), [16, 24, 32, 48, 64, 128, 256])

// resources/ -- runtime assets (window icon, tray), shipped via asarUnpack
writeFileSync(join(resourcesDir, 'icon.png'), renderPng(logoSvg, 512))
writeIco(join(resourcesDir, 'tray.ico'), [16, 20, 24, 32, 40, 48, 64])
writeFileSync(join(resourcesDir, 'tray.png'), renderPng(logoFor(32), 32))
writeFileSync(join(resourcesDir, 'tray@2x.png'), renderPng(logoFor(64), 64))
writeFileSync(join(resourcesDir, 'trayTemplate.png'), renderPng(traySvg, 16))
writeFileSync(join(resourcesDir, 'trayTemplate@2x.png'), renderPng(traySvg, 32))

console.log('icons written to build/ and resources/')
