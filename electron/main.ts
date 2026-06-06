import { app, BrowserWindow, ipcMain, dialog } from 'electron'
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
      const usedBlocks = parseInt(parts[2]) || 0
      const freeBlocks = parseInt(parts[3]) || 0

      // Only show physical volumes (skip devfs, map, etc)
      if (!parts[0].startsWith('/dev/')) continue
      // Skip small system volumes
      if (totalBlocks < 1024 * 1024) continue

      const totalSize = totalBlocks * 1024
      const usedSpace = usedBlocks * 1024
      const freeSpace = freeBlocks * 1024

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAF9F7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// IPC Handlers

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

ipcMain.handle('scan-directory', async (event, dirPath: string) => {
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    const result = await scanDir(dirPath, signal, (progress: ScanProgress) => {
      mainWindow?.webContents.send('scan-progress', progress)
    })
    return result
  } catch (err: any) {
    if (err.name === 'AbortError') return null
    throw err
  }
})

ipcMain.handle('cancel-scan', () => {
  scanAbortController?.abort()
  scanAbortController = null
})

async function scanDir(
  dirPath: string,
  signal: AbortSignal,
  onProgress: (info: ScanProgress) => void,
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
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return node
  }

  for (const entry of entries) {
    if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // Skip system directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$Recycle.Bin') {
        continue
      }
      const childNode = await scanDir(fullPath, signal, onProgress, counter)
      node.children!.push(childNode)
      node.size += childNode.size
    } else if (entry.isFile()) {
      try {
        const stats = fs.statSync(fullPath)
        const ext = path.extname(entry.name).toLowerCase()
        node.children!.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          isDirectory: false,
          extension: ext,
        })
        node.size += stats.size
      } catch {
        // Skip files we can't read
      }
    }

    counter.count++
    if (counter.count % 100 === 0) {
      onProgress({ scanned: counter.count, currentPath: fullPath })
      // Yield to event loop
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // Sort children by size descending
  node.children!.sort((a, b) => b.size - a.size)

  return node
}
