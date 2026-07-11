import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFileSync, execSync } from 'child_process'
import type { DiskInfo, FileNode, ScanProgress } from '../src/shared/types'

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

function getDisplayNameForPath(dirPath: string): string {
  const parsedRoot = path.parse(dirPath).root
  const normalizedPath = dirPath.replace(/[\\/]+$/, '')
  const normalizedRoot = parsedRoot.replace(/[\\/]+$/, '')

  if (
    dirPath === parsedRoot ||
    normalizedPath === normalizedRoot ||
    normalizedPath.length === 0
  ) {
    return parsedRoot || dirPath
  }

  return path.basename(normalizedPath) || dirPath
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
    if (typeof state.width === 'number' && typeof state.height === 'number') return state
  } catch {
    // First run or corrupt file — use defaults.
  }
  return {}
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify(mainWindow.getNormalBounds()))
  } catch {
    // Non-fatal: window just won't be restored next launch.
  }
}

/**
 * Replaces Electron's default menu. In production the View menu (with its
 * Reload accelerator) is omitted — reloading the renderer would orphan the
 * in-memory scan and drop the results view.
 */
function setupMenu() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (process.platform === 'darwin') {
    const template: MenuItemConstructorOptions[] = [
      { role: 'appMenu' },
      { role: 'editMenu' },
      ...(isDev ? [{ role: 'viewMenu' } as MenuItemConstructorOptions] : []),
      { role: 'windowMenu' },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    // Windows/Linux: no menu bar in production (View/reload only in dev).
    Menu.setApplicationMenu(isDev ? Menu.buildFromTemplate([{ role: 'viewMenu' }]) : null)
  }
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
    },
  })

  mainWindow.on('close', saveWindowState)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  setupMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// IPC Handlers

/** Maximum depth of the tree included in the initial scan-directory IPC response. */
const MAX_IPC_DEPTH = 3

/** In-memory cache of the last full scan result used for lazy expand-directory requests. */
let fullScanCache: FileNode | null = null

/**
 * Returns a copy of `node` that only includes children up to `maxDepth` levels
 * below the current depth. Directories that are cut off keep their `size` and
 * receive a `childCount` field so the renderer knows they can be expanded.
 */
function buildShallowTree(node: FileNode, currentDepth: number, maxDepth: number): FileNode {
  if (!node.isDirectory || !node.children) {
    return node
  }

  if (currentDepth >= maxDepth) {
    // Omit children but record how many there are so the renderer can lazy-load.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...rest } = node
    return { ...rest, childCount: node.children.length }
  }

  return {
    ...node,
    children: node.children.map((child) => buildShallowTree(child, currentDepth + 1, maxDepth)),
  }
}

/**
 * Finds the node in `root` whose `path` matches `targetPath`.
 * Child paths are built with path.join(parent, name), so we can descend the
 * tree following path prefixes instead of walking every node — O(depth ×
 * siblings) rather than O(total nodes), which matters on multi-million-file
 * scans. Falls back to a full search if the prefix descent dead-ends.
 */
function findNodeByPath(root: FileNode, targetPath: string): FileNode | null {
  let node: FileNode | null = root
  while (node) {
    if (node.path === targetPath) return node
    const parent: FileNode = node
    node =
      parent.children?.find(
        (c) =>
          c.path === targetPath ||
          (targetPath.startsWith(c.path) &&
            (c.path.endsWith(path.sep) || targetPath[c.path.length] === path.sep))
      ) ?? null
  }
  return findNodeByPathSlow(root, targetPath)
}

function findNodeByPathSlow(root: FileNode, targetPath: string): FileNode | null {
  if (root.path === targetPath) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNodeByPathSlow(child, targetPath)
    if (found) return found
  }
  return null
}

ipcMain.handle('get-drives', async () => {
  return getDisks()
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

let scanAbortController: AbortController | null = null

ipcMain.handle('scan-directory', async (event, dirPath: string, includeHidden = false) => {
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    const result = await scanDir(dirPath, signal, (progress: ScanProgress) => {
      mainWindow?.webContents.send('scan-progress', progress)
    }, includeHidden)
    // Cache the full tree so expand-directory can serve subtrees on demand.
    fullScanCache = result
    // Only send the first MAX_IPC_DEPTH levels to the renderer to keep the
    // initial IPC payload small and avoid freezing the renderer.
    return result ? buildShallowTree(result, 0, MAX_IPC_DEPTH) : null
  } catch (err: any) {
    if (err.name === 'AbortError') return null
    throw err
  }
})

/**
 * Returns the `count` largest files of the whole cached scan, size-descending.
 * Walks iteratively — the tree can hold millions of nodes.
 */
function collectTopFiles(root: FileNode, count: number): FileNode[] {
  const files: FileNode[] = []
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.isDirectory) {
      if (node.children) stack.push(...node.children)
    } else {
      files.push(node)
    }
  }
  files.sort((a, b) => b.size - a.size)
  return files.slice(0, count)
}

ipcMain.handle('get-top-files', (_event, count = 100) => {
  if (!fullScanCache) return null
  return collectTopFiles(fullScanCache, count)
})

/**
 * Saves a scan report via a native save dialog. The format follows the chosen
 * file extension: .json gets a structured summary, anything else gets CSV of
 * the top files. Returns the saved path, or null if cancelled.
 */
ipcMain.handle('export-report', async () => {
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

ipcMain.handle('reveal-in-folder', (_event, targetPath: string) => {
  shell.showItemInFolder(targetPath)
})

ipcMain.handle('move-to-trash', async (_event, targetPath: string) => {
  try {
    await shell.trashItem(targetPath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('cancel-scan', () => {
  scanAbortController?.abort()
  scanAbortController = null
})

/**
 * Returns the direct children of the directory at `dirPath` from the cached
 * scan result (one additional level of depth), so the renderer can populate
 * nodes it did not receive in the initial shallow payload.
 */
ipcMain.handle('expand-directory', (_event, dirPath: string) => {
  if (!fullScanCache) return null
  const node = findNodeByPath(fullScanCache, dirPath)
  if (!node || !node.isDirectory || !node.children) return null
  // Return shallow children (one more level so the user sees sub-items too).
  return node.children.map((child) => buildShallowTree(child, 0, 1))
})

/** Directory names skipped during scans on every platform. */
const SKIPPED_DIR_NAMES = new Set(['node_modules', '$Recycle.Bin', 'System Volume Information'])

/**
 * Absolute paths skipped during scans on macOS: /System/Volumes contains the
 * Data volume (already counted via firmlinks such as /Users and /Applications)
 * and /Volumes holds external drives, which should be scanned individually.
 */
const DARWIN_SKIPPED_PATHS = new Set(['/System/Volumes', '/Volumes', '/dev'])

async function scanDir(
  dirPath: string,
  signal: AbortSignal,
  onProgress: (info: ScanProgress) => void,
  includeHidden = false,
  counter = { count: 0 }
): Promise<FileNode> {
  if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

  const name = getDisplayNameForPath(dirPath)
  const node: FileNode = {
    name,
    path: dirPath,
    size: 0,
    isDirectory: true,
    children: [],
  }

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  } catch {
    // Typically a permissions error (e.g. macOS TCC-protected folders).
    // Flag it so the renderer can tell the user why the size reads 0.
    node.inaccessible = true
    return node
  }

  for (const entry of entries) {
    if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // Skip hidden/system directories unless the user opted in.
      if (!includeHidden && (entry.name.startsWith('.') || SKIPPED_DIR_NAMES.has(entry.name))) {
        continue
      }
      // On macOS, skip mount points that would double-count data (the Data
      // volume is already reachable through firmlinks like /Users) or pull in
      // external drives when scanning from the root. Never optional: these
      // would corrupt totals, not just hide detail.
      if (process.platform === 'darwin' && DARWIN_SKIPPED_PATHS.has(fullPath)) {
        continue
      }
      const childNode = await scanDir(fullPath, signal, onProgress, includeHidden, counter)
      node.children!.push(childNode)
      node.size += childNode.size
    } else if (entry.isFile()) {
      try {
        const stats = await fs.promises.stat(fullPath)
        const ext = path.extname(entry.name).toLowerCase()
        node.children!.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          isDirectory: false,
          extension: ext,
          mtime: stats.mtimeMs,
        })
        node.size += stats.size
      } catch {
        // Skip files we can't read
      }
    }

    counter.count++
    if (counter.count % 100 === 0) {
      onProgress({ scanned: counter.count, currentPath: fullPath })
      // Yield to the event loop between batches so IPC/UI messages are processed.
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }

  // Sort children by size descending
  node.children!.sort((a, b) => b.size - a.size)

  return node
}
