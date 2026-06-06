import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

export interface DiskInfo {
  name: string
  path: string
  totalSize: number
  freeSpace: number
  usedSpace: number
  filesystem?: string
}

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
    const output = execSync(
      'wmic logicaldisk get caption,freespace,size,volumename,filesystem /format:csv',
      { encoding: 'utf8' }
    )
    const lines = output.trim().split('\n').filter((l) => l.trim().length > 0)
    if (lines.length <= 1) return []

    const disks: DiskInfo[] = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(',')
      if (parts.length < 5) continue
      const caption = parts[1] // e.g. "C:"
      const filesystem = parts[2]
      const freeSpace = parseInt(parts[3]) || 0
      const totalSize = parseInt(parts[4]) || 0
      const volumeName = parts[5] || ''

      if (totalSize === 0) continue

      disks.push({
        name: volumeName ? `${volumeName} (${caption})` : caption,
        path: caption + '\\',
        totalSize,
        freeSpace,
        usedSpace: totalSize - freeSpace,
        filesystem,
      })
    }
    return disks
  } catch {
    // Fallback: just list drive letters
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
        // Drive doesn't exist
      }
    }
    return drives
  }
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

export interface FileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

let scanAbortController: AbortController | null = null

ipcMain.handle('scan-directory', async (event, dirPath: string) => {
  scanAbortController = new AbortController()
  const signal = scanAbortController.signal

  try {
    const result = await scanDir(dirPath, signal, (progress) => {
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
  onProgress: (info: { scanned: number; currentPath: string }) => void,
  counter = { count: 0 }
): Promise<FileNode> {
  if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

  const name = path.basename(dirPath)
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
