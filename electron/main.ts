import { app, BrowserWindow, clipboard, ipcMain, dialog, Menu, nativeImage, nativeTheme, screen, session, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile, execFileSync, execSync, spawn } from 'child_process'
import os from 'os'
import type { DiskInfo, FileNode, ScanProgress } from '../src/shared/types'
import { getFileCategory, type CategoryBreakdown } from '../src/shared/categories'
import {
  buildShallowTree,
  collectJunkDirs,
  collectTopFiles,
  findDuplicateGroups,
  findNodeByPath,
  removeNode,
  scanDir,
  searchTree,
} from './scanner'
import { asInt, asPath, asPathOrNull, asQuery, asStringList, isFilesystemRoot } from './validation'
import {
  aboutDetail,
  buildMenuTemplate,
  dialogText,
  menuLabels,
  menuLanguageFromLocale,
  type CleanupAction,
  type DialogKey,
  type MenuCommand,
  type MenuLanguage,
  type SelectionKind,
  trashSummary,
} from './menu'
import {
  isExecutablePath,
  measureTrashFolder,
  measureWindowsRecycleBin,
  moveItem,
  planMove,
  SourceNotRemovedError,
  type TrashInfo,
} from './fileActions'
import { formatSize } from '../src/utils/format'

function getDisks(): DiskInfo[] {
  const platform = process.platform

  if (platform === 'win32') {
    return getWindowsDisks()
  } else if (platform === 'darwin') {
    return getMacDisks()
  } else {
    return getLinuxDisks()
  }
}

function getWindowsDisks(): DiskInfo[] {
  try {
    return getWindowsDisksFromPowerShell()
  } catch {
    try {
      return getWindowsDisksFromWmic()
    } catch {
      return getWindowsDriveLetterFallback()
    }
  }
}

function getWindowsDisksFromPowerShell(): DiskInfo[] {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3,4 } | Select-Object DeviceID,FreeSpace,Size,VolumeName,FileSystem | ConvertTo-Json -Compress',
    ],
    { encoding: 'utf8' }
  )

  return parseWindowsDiskEntries(JSON.parse(output.trim() || '[]'))
}

function getWindowsDisksFromWmic(): DiskInfo[] {
  const output = execSync(
    'wmic logicaldisk get caption,freespace,size,volumename,filesystem /format:csv',
    { encoding: 'utf8' }
  )
  const lines = output.trim().split('\n').filter((line) => line.trim().length > 0)
  if (lines.length <= 1) return []

  const entries = lines.slice(1).map((line) => {
    const parts = line.trim().split(',')

    return {
      DeviceID: parts[1],
      FileSystem: parts[2],
      FreeSpace: parts[3],
      Size: parts[4],
      VolumeName: parts[5] || '',
    }
  })

  return parseWindowsDiskEntries(entries)
}

function parseWindowsDiskEntries(rawEntries: unknown): DiskInfo[] {
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : []
  const disks: DiskInfo[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    const deviceId = getStringProperty(entry, 'DeviceID')
    if (!deviceId) continue

    const freeSpace = Number.parseInt(getStringProperty(entry, 'FreeSpace') ?? '0', 10) || 0
    const totalSize = Number.parseInt(getStringProperty(entry, 'Size') ?? '0', 10) || 0
    const volumeName = getStringProperty(entry, 'VolumeName') ?? ''
    const filesystem = getStringProperty(entry, 'FileSystem') ?? undefined

    if (totalSize === 0) continue

    disks.push({
      name: volumeName ? `${volumeName} (${deviceId})` : deviceId,
      path: `${deviceId}\\`,
      totalSize,
      freeSpace,
      usedSpace: totalSize - freeSpace,
      filesystem,
    })
  }

  return disks
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const property = value[key]
  if (typeof property === 'string') return property
  if (typeof property === 'number') return String(property)
  return undefined
}

function getWindowsDriveLetterFallback(): DiskInfo[] {
  const drives: DiskInfo[] = []
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i)
    const drivePath = `${letter}:\\`
    try {
      fs.accessSync(drivePath)
      drives.push({
        name: `${letter}:`,
        path: drivePath,
        totalSize: 0,
        freeSpace: 0,
        usedSpace: 0,
      })
    } catch {
      // Drive does not exist
    }
  }
  return drives
}

function getMacDisks(): DiskInfo[] {
  try {
    const output = execSync('df -k', { encoding: 'utf8' })
    const lines = output.trim().split('\n')
    const disks: DiskInfo[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/)
      if (parts.length < 6) continue

      const mountPoint = parts.slice(8).join(' ') || parts[parts.length - 1]
      const totalBlocks = parseInt(parts[1]) || 0
      const freeBlocks = parseInt(parts[3]) || 0

      // Only show physical volumes (skip devfs, map, etc)
      if (!parts[0].startsWith('/dev/')) continue
      // Skip small system volumes
      if (totalBlocks < 1024 * 1024) continue
      // Skip APFS helper volumes (Preboot, Update, Data, VM…) — the Data
      // volume is reachable from '/' via firmlinks, so listing it separately
      // would duplicate "Macintosh HD".
      if (mountPoint.startsWith('/System/Volumes/') || mountPoint.startsWith('/private/')) continue

      const totalSize = totalBlocks * 1024
      const freeSpace = freeBlocks * 1024
      // On APFS the boot volume's own "used" blocks exclude the shared
      // container (the Data volume), so derive usage from free space instead.
      const usedSpace = totalSize - freeSpace

      disks.push({
        name: mountPoint === '/' ? 'Macintosh HD' : path.basename(mountPoint),
        path: mountPoint,
        totalSize,
        freeSpace,
        usedSpace,
        filesystem: parts[0],
      })
    }
    return disks
  } catch {
    return [{ name: 'Macintosh HD', path: '/', totalSize: 0, freeSpace: 0, usedSpace: 0 }]
  }
}

function getLinuxDisks(): DiskInfo[] {
  try {
    const output = execSync('df -k --output=source,fstype,size,used,avail,target', { encoding: 'utf8' })
    const lines = output.trim().split('\n')
    const disks: DiskInfo[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/)
      if (parts.length < 6) continue

      const source = parts[0]
      const fstype = parts[1]
      const totalBlocks = parseInt(parts[2]) || 0
      const usedBlocks = parseInt(parts[3]) || 0
      const freeBlocks = parseInt(parts[4]) || 0
      const mountPoint = parts.slice(5).join(' ')

      // Only show real filesystems
      if (!source.startsWith('/dev/')) continue
      if (['tmpfs', 'devtmpfs', 'squashfs'].includes(fstype)) continue
      if (totalBlocks < 1024 * 1024) continue

      const totalSize = totalBlocks * 1024
      const usedSpace = usedBlocks * 1024
      const freeSpace = freeBlocks * 1024

      disks.push({
        name: mountPoint === '/' ? 'Root' : path.basename(mountPoint) || mountPoint,
        path: mountPoint,
        totalSize,
        freeSpace,
        usedSpace,
        filesystem: fstype,
      })
    }
    return disks
  } catch {
    return [{ name: 'Root', path: '/', totalSize: 0, freeSpace: 0, usedSpace: 0 }]
  }
}

let mainWindow: BrowserWindow | null = null

/** Persisted window bounds so the app reopens where the user left it. */
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState(): Partial<Electron.Rectangle> {
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'))
    if (typeof state.width === 'number' && typeof state.height === 'number') {
      const size = { width: state.width, height: state.height }
      // A saved position may belong to a monitor that is no longer connected; in that case
      // keep the size and let the OS place the window instead of opening it off-screen.
      return isPositionOnScreen(state) ? { ...size, x: state.x, y: state.y } : size
    }
  } catch {
    // First run or corrupt file — use defaults.
  }
  return {}
}

/** True if enough of the window (and its title bar) would be visible on some connected display. */
function isPositionOnScreen(bounds: Partial<Electron.Rectangle>): boolean {
  const { x, y, width, height } = bounds
  if (![x, y, width, height].every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  const MIN_VISIBLE = 100
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapX = Math.min(x! + width!, workArea.x + workArea.width) - Math.max(x!, workArea.x)
    const titleBarVisible = y! >= workArea.y - 10 && y! <= workArea.y + workArea.height - MIN_VISIBLE
    return overlapX >= MIN_VISIBLE && titleBarVisible
  })
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify(mainWindow.getNormalBounds()))
  } catch {
    // Non-fatal: window just won't be restored next launch.
  }
}

/** Language of the native menu; follows the UI language once the renderer reports it. */
let menuLanguage: MenuLanguage = 'en'

/**
 * Replaces Electron's default menu (File, Edit, View, Help → About). There is no Reload in
 * production: reloading the renderer would orphan the in-memory scan and drop the results view.
 */
function setupMenu() {
  const template = buildMenuTemplate({
    platform: process.platform,
    language: menuLanguage,
    isDev: !!process.env.VITE_DEV_SERVER_URL,
    onCommand: sendMenuCommand,
    onAbout: () => void showAboutDialog(),
    selection: selectionKind(),
    trash: trashInfo,
    onCleanup: runCleanupAction,
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function sendMenuCommand(command: MenuCommand) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  mainWindow.webContents.send('menu-command', command)
}

function aboutInfo() {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
    arch: process.arch,
  }
}

/** Windows/Linux About dialog: version, runtime versions and copyright, with a "Copy" button for support. */
async function showAboutDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const detail = aboutDetail(menuLanguage, aboutInfo())
  const es = menuLanguage === 'es'
  // The app's own icon (public/icon.png, copied into dist/ by Vite). app.getFileIcon() on the exe returns
  // Windows' generic program icon, and in development there is no GreekDir exe at all.
  const iconPath = path.join(__dirname, '../dist/icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 128, height: 128, quality: 'best' }) : undefined
  const { response } = await dialog.showMessageBox(mainWindow, {
    title: menuLabels(menuLanguage).about,
    message: 'GreekDir',
    detail,
    icon,
    buttons: ['OK', es ? 'Copiar información' : 'Copy Info'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  if (response === 1) await clipboard.writeText(`GreekDir\n${detail}`)
}

// ---------------------------------------------------------------------------
// Clean Up actions
//
// Run from the Clean Up menu (on the item selected in the results view) and from the renderer
// (keyboard shortcuts, context menu) through the IPC handlers below. Every confirmation is a
// native dialog shown here, so the untrusted renderer cannot skip it. Only items that are part
// of the current scan are ever touched.
// ---------------------------------------------------------------------------

/** Path selected in the results view (validated against the scan). */
let selectedPath: string | null = null
/** Recycle Bin / Trash size shown in the Clean Up menu; null while unknown or unreadable. */
let trashInfo: TrashInfo | null = null

const dt = (key: DialogKey, values?: Record<string, string>) => dialogText(menuLanguage, key, values)

/**
 * Windows system tools by absolute path: a PATH lookup could find something else first
 * (Git for Windows ships a GNU `whoami`, for instance) or a planted program.
 */
const system32 = (...parts: string[]) => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', ...parts)
const WINDOWS_POWERSHELL = () => system32('WindowsPowerShell', 'v1.0', 'powershell.exe')
const displayName = (node: FileNode) => node.name || node.path

function selectedNode(): FileNode | null {
  return selectedPath ? findScannedNode(selectedPath) : null
}

function selectionKind(): SelectionKind {
  const node = selectedNode()
  return !node ? 'none' : node.isDirectory ? 'directory' : 'file'
}

function setSelection(targetPath: string | null) {
  const node = targetPath ? findScannedNode(targetPath) : null
  const next = node?.path ?? null
  if (next === selectedPath) return
  const hadSelection = selectedPath !== null
  selectedPath = next
  // The enabled state of the Clean Up items only changes when a selection appears or goes away.
  if (hadSelection !== (next !== null)) setupMenu()
}

function runCleanupAction(action: CleanupAction) {
  const node = selectedNode()
  switch (action) {
    case 'open':
      if (node) void openItem(node)
      break
    case 'reveal':
      if (node) shell.showItemInFolder(node.path)
      break
    case 'terminal':
      if (node) void openTerminal(node)
      break
    case 'trash':
      if (node) void trashWithConfirmation(node)
      break
    case 'move':
      if (node) void moveWithPicker(node)
      break
    case 'empty-trash':
      void emptyTrash()
      break
    case 'disk-cleanup':
      void launchDetached(system32('cleanmgr.exe'), [])
      break
    case 'installed-apps':
      void shell.openExternal('ms-settings:appsfeatures')
      break
  }
}

async function confirmDialog(options: { title: string; message: string; detail: string; confirm: string }): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: options.title,
    message: options.message,
    detail: options.detail,
    buttons: [options.confirm, dt('cancel')],
    // Enter and Escape both cancel: these actions run code or delete data.
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })
  return response === 0
}

function showError(message: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  void dialog.showMessageBox(mainWindow, { type: 'error', title: 'GreekDir', message, buttons: ['OK'], noLink: true })
}

/** Tells the renderer that items left the scan (trashed or moved) so every view hides them. */
function notifyRemoved(paths: string[]) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('items-removed', paths)
}

/** The scan root and filesystem roots are never trashed or moved. */
function isProtectedNode(node: FileNode): boolean {
  return !fullScanCache || node === fullScanCache || isFilesystemRoot(node.path)
}

/** Opens a file with its default app (a folder in the file manager). Programs and scripts ask first. */
async function openItem(node: FileNode): Promise<'opened' | 'canceled' | 'failed'> {
  if (isExecutablePath(node.path)) {
    const confirmed = await confirmDialog({
      title: dt('openRunTitle'),
      message: dt('openRunMessage', { name: displayName(node) }),
      detail: dt('openRunDetail'),
      confirm: dt('openRunConfirm'),
    })
    if (!confirmed) return 'canceled'
  }
  const error = await shell.openPath(node.path)
  if (!error) return 'opened'
  showError(dt('openFailed', { name: displayName(node) }))
  return 'failed'
}

/** Starts a program in the background, detached from GreekDir. Resolves false if it could not start. */
function launchDetached(command: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { cwd, detached: true, stdio: 'ignore' })
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}

/**
 * Opens a terminal in the folder (or in a file's folder). The path is passed as the working
 * directory or as a single argument, never through a shell.
 */
async function openTerminal(node: FileNode): Promise<boolean> {
  const dir = node.isDirectory ? node.path : path.dirname(node.path)
  let ok = false
  if (process.platform === 'win32') {
    // Windows Terminal when installed (it splits its arguments on ';', so not for such paths),
    // otherwise PowerShell in its own console window.
    const wt = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'wt.exe') : ''
    if (wt && fs.existsSync(wt) && !dir.includes(';')) ok = await launchDetached(wt, ['-d', dir])
    if (!ok) ok = await launchDetached(WINDOWS_POWERSHELL(), ['-NoExit'], dir)
  } else if (process.platform === 'darwin') {
    ok = await launchDetached('open', ['-a', 'Terminal', dir])
  } else {
    for (const terminal of ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm']) {
      ok = await launchDetached(terminal, [], dir)
      if (ok) break
    }
  }
  if (!ok) showError(dt('terminalFailed', { dir }))
  return ok
}

/** Moves a scanned item to the trash and drops it from the cache. */
async function trashNode(node: FileNode): Promise<boolean> {
  if (isProtectedNode(node)) return false
  try {
    await shell.trashItem(node.path)
  } catch {
    return false
  }
  removeNode(fullScanCache!, node.path)
  if (selectedPath === node.path) setSelection(null)
  scheduleTrashRefresh()
  return true
}

/** Delete key / Clean Up menu: asks first (the in-page buttons have their own two-click confirmation). */
async function trashWithConfirmation(node: FileNode): Promise<'trashed' | 'canceled' | 'failed'> {
  if (isProtectedNode(node)) return 'failed'
  const confirmed = await confirmDialog({
    title: dt('trashTitle'),
    message: dt('trashMessage', { name: displayName(node), size: formatSize(node.size) }),
    detail: dt('trashDetail'),
    confirm: dt('trashConfirm'),
  })
  if (!confirmed) return 'canceled'
  if (!(await trashNode(node))) {
    showError(dt('trashFailed', { name: displayName(node) }))
    return 'failed'
  }
  notifyRemoved([node.path])
  return 'trashed'
}

/** Asks for a folder and moves the item there (never overwriting). */
async function moveWithPicker(node: FileNode): Promise<'moved' | 'canceled' | 'failed'> {
  if (isProtectedNode(node) || !mainWindow || mainWindow.isDestroyed()) return 'failed'
  const name = displayName(node)
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: dt('moveTitle', { name }),
    buttonLabel: dt('moveButton'),
    defaultPath: path.dirname(node.path),
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  })
  if (picked.canceled || picked.filePaths.length === 0) return 'canceled'

  const plan = planMove(node.path, picked.filePaths[0])
  if (!plan.ok) {
    const key = plan.reason === 'same-folder' ? 'moveSameFolder' : plan.reason === 'inside-source' ? 'moveInside' : 'moveExists'
    showError(dt(key, { name }))
    return 'failed'
  }

  // A move to another drive is a copy: show progress on the taskbar button meanwhile.
  mainWindow.setProgressBar(2)
  try {
    await moveItem(node.path, plan.destination)
  } catch (err) {
    if (err instanceof SourceNotRemovedError) {
      showError(dt('moveSourceKept', { name, dest: plan.destination }))
    } else {
      showError(dt('moveFailed', { name }))
    }
    return 'failed'
  } finally {
    if (!mainWindow.isDestroyed()) mainWindow.setProgressBar(-1)
  }
  removeNode(fullScanCache!, node.path)
  if (selectedPath === node.path) setSelection(null)
  notifyRemoved([node.path])
  return 'moved'
}

// --- Recycle Bin / Trash ----------------------------------------------------

let windowsUserSid: string | null = null

function getWindowsUserSid(): Promise<string | null> {
  if (windowsUserSid) return Promise.resolve(windowsUserSid)
  return new Promise((resolve) => {
    execFile(system32('whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 10_000 }, (err, stdout) => {
      const sid = err ? null : stdout.match(/S-1-[\d-]+/)?.[0] ?? null
      windowsUserSid = sid
      resolve(sid)
    })
  })
}

const xdgTrashFiles = () =>
  path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'Trash', 'files')

async function measureTrash(): Promise<TrashInfo | null> {
  if (process.platform === 'win32') {
    const sid = await getWindowsUserSid()
    if (!sid) return null
    // This user's folder in each drive's Recycle Bin (A: and B: are skipped: legacy floppy letters).
    const dirs = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `${letter}:\\$Recycle.Bin\\${sid}`)
    return measureWindowsRecycleBin(dirs.filter((dir) => fs.existsSync(dir)))
  }
  if (process.platform === 'darwin') return measureTrashFolder(path.join(os.homedir(), '.Trash'))
  return measureTrashFolder(xdgTrashFiles())
}

let trashRefreshTimer: NodeJS.Timeout | null = null
/** The measurement in progress, if any; a request made meanwhile runs once it finishes. */
let trashRefresh: Promise<void> | null = null
let trashRefreshAgain = false
let lastTrashRefresh = 0

/** Re-measures the trash and relabels the Clean Up menu. Coalesces bursts (bulk deletes). */
function scheduleTrashRefresh(delayMs = 1500) {
  if (trashRefreshTimer) clearTimeout(trashRefreshTimer)
  trashRefreshTimer = setTimeout(() => {
    trashRefreshTimer = null
    void refreshTrashInfo()
  }, delayMs)
}

/** Measures the trash (a large one takes a few seconds) and relabels the menu when it changed. */
function refreshTrashInfo(): Promise<void> {
  if (trashRefresh) {
    trashRefreshAgain = true
    return trashRefresh
  }
  trashRefresh = (async () => {
    do {
      trashRefreshAgain = false
      const info = await measureTrash().catch(() => null)
      lastTrashRefresh = Date.now()
      if (info?.items !== trashInfo?.items || info?.size !== trashInfo?.size) {
        trashInfo = info
        setupMenu()
      }
    } while (trashRefreshAgain)
  })().finally(() => {
    trashRefresh = null
  })
  return trashRefresh
}

/** On window focus (the user may have emptied or restored items elsewhere), at most once a minute. */
function refreshTrashInfoOnFocus() {
  if (Date.now() - lastTrashRefresh > 60_000) scheduleTrashRefresh(0)
}

function runQuiet(command: string, args: string[]): Promise<void> {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true, timeout: 120_000 }, () => resolve())
  })
}

/** Permanently deletes the contents of the Recycle Bin / Trash, after a confirmation. */
async function emptyTrash() {
  // Confirm with the last measured size (kept current on focus and after every trash action)
  // rather than re-measuring first, which takes seconds on a large Recycle Bin.
  if (trashInfo && trashInfo.items === 0) return
  const confirmed = await confirmDialog({
    title: dt('emptyTitle'),
    message: trashInfo ? dt('emptyMessage', { detail: trashSummary(menuLanguage, trashInfo) }) : dt('emptyMessageUnknown'),
    detail: dt('emptyDetail'),
    confirm: dt('emptyConfirm'),
  })
  if (!confirmed) return

  if (process.platform === 'win32') {
    // Clear-RecycleBin reports an error for drives without a Recycle Bin, so success is judged
    // by measuring again below.
    await runQuiet(WINDOWS_POWERSHELL(), ['-NoProfile', '-NonInteractive', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'])
  } else if (process.platform === 'darwin') {
    await runQuiet('osascript', ['-e', 'tell application "Finder" to empty trash'])
  } else {
    const files = xdgTrashFiles()
    const info = path.join(path.dirname(files), 'info')
    for (const dir of [files, info]) {
      const names = await fs.promises.readdir(dir).catch(() => [] as string[])
      await Promise.all(names.map((name) => fs.promises.rm(path.join(dir, name), { recursive: true, force: true }).catch(() => {})))
    }
  }

  // Wait for any measurement already running, then measure the emptied trash.
  await trashRefresh
  await refreshTrashInfo()
  if (trashInfo && trashInfo.items > 0) showError(dt('emptyFailed'))
}

function createWindow() {
  const savedState = loadWindowState()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    ...savedState,
    minWidth: 900,
    minHeight: 600,
    // 'hiddenInset' is macOS-only; keep the native frame elsewhere so Windows
    // retains its standard window controls.
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    // Match the OS theme so the pre-load flash isn't blinding in dark mode.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17171A' : '#FAF9F7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('close', saveWindowState)
  mainWindow.on('focus', refreshTrashInfoOnFocus)

  // The UI is a single local page: it never opens windows or navigates elsewhere.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// One instance per user-data directory: a second launch just brings the existing window to the front
// instead of opening a second one that would fight over the same settings files. (The installer's
// "Run once" mode starts the app with its own temporary user-data directory, so it is not affected.)
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.whenReady().then(() => {
  if (!isPrimaryInstance) return
  // GreekDir needs no browser permissions (camera, notifications, geolocation, ...): deny them all.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  menuLanguage = menuLanguageFromLocale(app.getLocale())
  // macOS: the app menu's "About GreekDir" opens the native About panel with these details.
  app.setAboutPanelOptions({
    applicationName: 'GreekDir',
    applicationVersion: app.getVersion(),
    version: `Electron ${process.versions.electron}`,
    copyright: '© 2026 CHV Network Technologies',
  })
  setupMenu()
  createWindow()
  scheduleTrashRefresh(3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ---------------------------------------------------------------------------
// IPC
//
// Every handler is registered through secureHandle(): only the app's own main
// window (its top-level frame) may call it, and every argument is validated
// because the renderer is treated as untrusted. File operations only accept
// paths that exist in the current scan.
// ---------------------------------------------------------------------------

type IpcListener = Parameters<typeof ipcMain.handle>[1]

/** Only the main window's top-level frame is allowed to talk to the main process. */
function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  return (
    mainWindow !== null &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents &&
    event.senderFrame != null &&
    event.senderFrame.parent === null
  )
}

function secureHandle(channel: string, listener: IpcListener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Rejected IPC call to "${channel}" from an untrusted sender`)
    }
    return listener(event, ...args)
  })
}

/** Maximum depth of the tree included in the initial scan-directory IPC response. */
const MAX_IPC_DEPTH = 3

/** In-memory cache of the last full scan result used for lazy expand-directory requests. */
let fullScanCache: FileNode | null = null

/** The node for `targetPath`, only if it is part of the current scan. */
function findScannedNode(targetPath: unknown): FileNode | null {
  const validPath = asPathOrNull(targetPath)
  if (!fullScanCache || !validPath) return null
  return findNodeByPath(fullScanCache, validPath)
}

/** macOS: opens System Settings → Privacy & Security → Full Disk Access (a fixed system URL). */
secureHandle('open-privacy-settings', () => {
  if (process.platform !== 'darwin') return
  void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
})

secureHandle('set-language', (_event, language) => {
  if (language !== 'en' && language !== 'es') throw new Error('Invalid language')
  if (language === menuLanguage) return
  menuLanguage = language
  setupMenu()
})

secureHandle('get-drives', async () => {
  return getDisks()
})

secureHandle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

let scanAbortController: AbortController | null = null

secureHandle('scan-directory', async (_event, rawPath, rawIncludeHidden, rawExcludePatterns) => {
  const dirPath = path.normalize(asPath(rawPath, 'scan path'))
  const includeHidden = rawIncludeHidden === true
  const excludePatterns = asStringList(rawExcludePatterns)

  const stats = await fs.promises.stat(dirPath).catch(() => null)
  if (!stats?.isDirectory()) throw new Error('The scan path is not a directory')

  setSelection(null)

  // Only one scan at a time: a new request supersedes any scan still running.
  scanAbortController?.abort()
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    const result = await scanDir(dirPath, signal, (progress: ScanProgress) => {
      mainWindow?.webContents.send('scan-progress', progress)
    }, includeHidden, undefined, excludePatterns)
    // Cache the full tree so expand-directory can serve subtrees on demand.
    fullScanCache = result
    // Only send the first MAX_IPC_DEPTH levels to the renderer to keep the
    // initial IPC payload small and avoid freezing the renderer.
    return result ? buildShallowTree(result, 0, MAX_IPC_DEPTH) : null
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null
    throw err
  }
})

secureHandle('get-top-files', (_event, count) => {
  if (!fullScanCache) return null
  return collectTopFiles(fullScanCache, asInt(count, 100, 1, 1000))
})

/**
 * Saves a scan report via a native save dialog. The format follows the chosen
 * file extension: .json gets a structured summary, anything else gets CSV of
 * the top files. Returns the saved path, or null if cancelled.
 */
secureHandle('export-report', async () => {
  if (!fullScanCache || !mainWindow) return null

  const date = new Date().toISOString().slice(0, 10)
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `greekdir-report-${date}.csv`,
    filters: [
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })
  if (result.canceled || !result.filePath) return null

  const root = fullScanCache
  const topFiles = collectTopFiles(root, 100)

  let content: string
  if (result.filePath.toLowerCase().endsWith('.json')) {
    content = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        root: { path: root.path, size: root.size },
        folders: (root.children ?? [])
          .filter((c) => c.isDirectory)
          .map((c) => ({ path: c.path, size: c.size })),
        topFiles: topFiles.map((f) => ({ path: f.path, size: f.size })),
      },
      null,
      2
    )
  } else {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const lines = ['rank,size_bytes,path']
    topFiles.forEach((f, i) => {
      lines.push(`${i + 1},${f.size},${escapeCsv(f.path)}`)
    })
    content = lines.join('\n') + '\n'
  }

  await fs.promises.writeFile(result.filePath, content, 'utf8')
  return result.filePath
})

/**
 * Sums file sizes per category for the subtree rooted at `dirPath`
 * (defaults to the scan root), size-descending.
 */
secureHandle('get-category-breakdown', (_event, rawPath) => {
  if (!fullScanCache) return null
  const root = rawPath === undefined || rawPath === null ? fullScanCache : findScannedNode(rawPath)
  if (!root) return null

  const sizes = new Map<string, number>()
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.isDirectory) {
      if (node.children) stack.push(...node.children)
    } else {
      const category = getFileCategory(node.extension)
      sizes.set(category, (sizes.get(category) ?? 0) + node.size)
    }
  }

  const breakdown: CategoryBreakdown[] = [...sizes.entries()]
    .map(([category, size]) => ({ category, size }))
    .sort((a, b) => b.size - a.size)
  return breakdown
})

/** Searches the whole cached scan by name substring and returns the largest `limit` matches. */
secureHandle('search-files', (_event, query, limit) => {
  if (!fullScanCache) return null
  return searchTree(fullScanCache, asQuery(query), asInt(limit, 200, 1, 1000))
})

secureHandle('find-duplicates', async () => {
  if (!fullScanCache) return null
  return findDuplicateGroups(fullScanCache, {
    onProgress: (hashed) => mainWindow?.webContents.send('duplicates-progress', { hashed }),
  })
})

secureHandle('get-cleanup-suggestions', () => {
  if (!fullScanCache) return null
  return collectJunkDirs(fullScanCache)
})

secureHandle('reveal-in-folder', (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  if (node) shell.showItemInFolder(node.path)
})

/**
 * Moves a scanned file or folder to the trash. Refuses anything that is not part of
 * the current scan, the scan root, and filesystem roots. On success the item is also
 * dropped from the cache so later queries stay consistent.
 */
secureHandle('move-to-trash', async (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  return node ? trashNode(node) : false
})

// Clean Up actions requested by the renderer (keyboard shortcuts, context menu). Each one shows
// its own native confirmation or picker; see the Clean Up actions section above.
secureHandle('set-selection', (_event, targetPath) => {
  setSelection(targetPath === null ? null : asPathOrNull(targetPath))
})

secureHandle('open-item', async (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  return node ? openItem(node) : 'failed'
})

secureHandle('open-terminal', async (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  return node ? openTerminal(node) : false
})

secureHandle('trash-with-confirmation', async (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  return node ? trashWithConfirmation(node) : 'failed'
})

secureHandle('move-item', async (_event, targetPath) => {
  const node = findScannedNode(targetPath)
  return node ? moveWithPicker(node) : 'failed'
})

secureHandle('cancel-scan', () => {
  scanAbortController?.abort()
  scanAbortController = null
})

/**
 * Returns the direct children of the directory at `dirPath` from the cached
 * scan result (one additional level of depth), so the renderer can populate
 * nodes it did not receive in the initial shallow payload.
 */
secureHandle('expand-directory', (_event, dirPath) => {
  const node = findScannedNode(dirPath)
  if (!node || !node.isDirectory || !node.children) return null
  // Return shallow children (one more level so the user sees sub-items too).
  return node.children.map((child) => buildShallowTree(child, 0, 1))
})
