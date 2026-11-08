/**
 * Renders the app icons from the SVG sources in build/:
 *   build/icon.png   1024 px, macOS grid (plate with margin and shadow) — Linux and the docs
 *   build/icon.ico   Windows: 16–256 px; 16 px from icon-16.svg, 20–32 px from icon-32.svg,
 *                    larger sizes from icon.svg cropped so the plate fills more of the square
 *   build/icon.icns  macOS: 16–1024 px from icon.svg
 *
 * Uses Electron's own Chromium as the SVG renderer, so no extra dependencies:
 *   npm run icons      (= electron scripts/build-icons.cjs)
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const BUILD = path.join(__dirname, '..', 'build')
const read = (name) => fs.readFileSync(path.join(BUILD, name), 'utf8')

const large = read('icon.svg')
const small32 = read('icon-32.svg')
const small16 = read('icon-16.svg')

/** The large icon cropped for Windows: the plate fills ~90% instead of the macOS 80%. */
const WINDOWS_VIEWBOX = '52 52 920 920'

/** Sets the SVG's rendered size (and optionally its viewBox) so Chromium rasterizes it at that size. */
function sized(svg, size, viewBox) {
  let out = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `<svg$1 width="${size}" height="${size}"`)
  if (viewBox) out = out.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)
  return out
}

/**
 * At 40–64 px the large icon's 7-unit rim is under half a pixel and the plate edge fades away.
 * Thicken the rim and the top highlight to about one real pixel (the strokes are clipped to the
 * plate, so only their inner half shows).
 */
function withRimForSize(svg, size) {
  if (size >= 128) return svg
  const unitsPerPixel = 920 / size
  return svg
    .replace('stroke="url(#rim)" stroke-width="7"', `stroke="url(#rim)" stroke-width="${(2.2 * unitsPerPixel).toFixed(1)}"`)
    .replace('stroke="url(#highlight)" stroke-width="10"', `stroke="url(#highlight)" stroke-width="${(1.6 * unitsPerPixel).toFixed(1)}"`)
}

async function renderAll(win, jobs) {
  const payload = JSON.stringify(jobs.map((j) => ({ size: j.size, svg: j.svg })))
  const dataUrls = await win.webContents.executeJavaScript(`(async () => {
    const jobs = ${payload}
    const out = []
    for (const { size, svg } of jobs) {
      const img = new Image()
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, size, size)
      out.push(canvas.toDataURL('image/png'))
    }
    return out
  })()`)
  return dataUrls.map((url) => Buffer.from(url.split(',')[1], 'base64'))
}

/** ICO with PNG-compressed entries (supported since Windows Vista). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

/** ICNS with PNG chunks. */
function buildIcns(chunks) {
  const parts = chunks.map(({ type, png }) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

const WINDOWS = [
  { size: 16, svg: sized(small16, 16) },
  { size: 20, svg: sized(small32, 20) },
  { size: 24, svg: sized(small32, 24) },
  { size: 32, svg: sized(small32, 32) },
  ...[40, 48, 64, 128, 256].map((size) => ({ size, svg: sized(withRimForSize(large, size), size, WINDOWS_VIEWBOX) })),
]

// [chunk type, pixel size]
const MAC = [
  ['icp4', 16], ['icp5', 32], ['ic11', 32], ['icp6', 64], ['ic12', 64], ['ic07', 128],
  ['ic08', 256], ['ic13', 256], ['ic09', 512], ['ic14', 512], ['ic10', 1024],
]

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true } })
  await win.loadURL('about:blank')
  try {
    const winPngs = await renderAll(win, WINDOWS)
    fs.writeFileSync(path.join(BUILD, 'icon.ico'), buildIco(WINDOWS.map((j, i) => ({ size: j.size, png: winPngs[i] }))))

    const macPngs = await renderAll(win, MAC.map(([, size]) => ({ size, svg: sized(large, size) })))
    fs.writeFileSync(path.join(BUILD, 'icon.icns'), buildIcns(MAC.map(([type], i) => ({ type, png: macPngs[i] }))))
    fs.writeFileSync(path.join(BUILD, 'icon.png'), macPngs[MAC.length - 1])

    // Previews of every Windows size, for checking the small icons by eye.
    const previewDir = process.env.ICON_PREVIEW_DIR
    if (previewDir) {
      fs.mkdirSync(previewDir, { recursive: true })
      WINDOWS.forEach((j, i) => fs.writeFileSync(path.join(previewDir, `win-${j.size}.png`), winPngs[i]))
    }
    console.log('Wrote build/icon.png, build/icon.ico, build/icon.icns')
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})
