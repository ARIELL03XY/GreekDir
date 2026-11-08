#!/usr/bin/env node
/**
 * Smoke test for a packaged GreekDir build, used by CI on macOS (works on any platform):
 *
 *   node scripts/smoke-test.mjs <path to the GreekDir executable> <output folder>
 *
 * Launches the app with a throwaway profile and Chromium's remote debugging port (the hardened
 * fuses disable --inspect, not this), then checks over the DevTools protocol that the UI loaded,
 * the preload bridge exists, the disk list works and a real scan of a small fixture folder returns
 * the right total. Saves a screenshot of the window to the output folder. Exits non-zero on failure.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [executable, outDir = 'smoke'] = process.argv.slice(2)
if (!executable || !fs.existsSync(executable)) {
  console.error(`usage: smoke-test.mjs <GreekDir executable> [output folder] (not found: ${executable})`)
  process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })

const PORT = 9333
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'greekdir-smoke-'))
const profile = path.join(work, 'profile')
const fixture = path.join(work, 'fixture')
fs.mkdirSync(path.join(fixture, 'nested'), { recursive: true })
fs.writeFileSync(path.join(fixture, 'a.bin'), Buffer.alloc(300_000))
fs.writeFileSync(path.join(fixture, 'nested', 'b.bin'), Buffer.alloc(200_000))
const FIXTURE_BYTES = 500_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

const app = spawn(executable, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--lang=en-US'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let exited = null
app.on('exit', (code, signal) => (exited = { code, signal }))
app.stdout.on('data', (d) => process.stdout.write(`[app] ${d}`))
app.stderr.on('data', (d) => process.stdout.write(`[app] ${d}`))

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    if (exited) throw new Error(`the app exited early: ${JSON.stringify(exited)}`)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'))
      if (page) return page
    } catch {
      // not listening yet
    }
    await sleep(500)
  }
  throw new Error('no DevTools page target after 30 s')
}

function connect(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id
      pending.set(i, resolve)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed')
    return r.result?.result?.value
  }
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ send, evaluate, close: () => ws.close() })
    ws.onerror = reject
  })
}

try {
  const target = await pageTarget()
  const cdp = await connect(target.webSocketDebuggerUrl)
  for (let i = 0; i < 20 && !(await cdp.evaluate('document.body?.innerText.length > 0')); i++) await sleep(500)

  check('window title', (await cdp.evaluate('document.title')).startsWith('GreekDir'))
  const platform = await cdp.evaluate('window.electronAPI?.platform')
  check('preload bridge', typeof platform === 'string', `platform=${platform}`)
  check('welcome screen rendered', await cdp.evaluate("document.body.innerText.includes('Analyze your disk usage')"))

  const drives = await cdp.evaluate('window.electronAPI.getDrives()')
  check('disk list', Array.isArray(drives) && drives.length > 0, drives?.map((d) => `${d.name} ${d.path}`).join(', '))
  if (platform === 'darwin') {
    check('macOS boot volume listed', drives.some((d) => d.path === '/'))
    check('no APFS helper volumes', !drives.some((d) => d.path.startsWith('/System/Volumes/')))
  }

  const tree = await cdp.evaluate(`window.electronAPI.scanDirectory(${JSON.stringify(fixture)})`)
  check('scan of a fixture folder', tree?.size === FIXTURE_BYTES, `size=${tree?.size}, children=${tree?.children?.length}`)

  await sleep(800)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  if (shot.result?.data) fs.writeFileSync(path.join(outDir, 'window.png'), Buffer.from(shot.result.data, 'base64'))
  check('screenshot', !!shot.result?.data)
  cdp.close()
} catch (err) {
  check('smoke test ran', false, err.message)
} finally {
  if (!exited) app.kill()
  await sleep(1000)
  fs.rmSync(work, { recursive: true, force: true })
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll smoke checks passed')
process.exit(failures.length ? 1 : 0)
