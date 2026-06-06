import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

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
