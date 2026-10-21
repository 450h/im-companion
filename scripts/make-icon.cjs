/**
 * Renders build/icon.svg to build/icon.png (512) and build/icon.ico (16–256, PNG-encoded entries)
 * using Electron's offscreen renderer. Run: npx electron scripts/make-icon.cjs
 * (unset ELECTRON_RUN_AS_NODE first if your shell sets it).
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

async function render(win, size) {
  const html = `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 150))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  return img.resize({ width: size, height: size, quality: 'best' }).toPNG()
}

function ico(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)])
}

setTimeout(() => {
  console.error('timed out')
  process.exit(1)
}, 60_000)

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, paintWhenInitiallyHidden: true })
  const big = await render(win, 512)
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), big)
  const pngs = []
  for (const size of SIZES) pngs.push({ size, data: await render(win, size) })
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico(pngs))
  console.log('wrote build/icon.png and build/icon.ico')
  app.quit()
})
