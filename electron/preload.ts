import { contextBridge, ipcRenderer } from 'electron'
import type { FileNode, ScanProgress } from '../src/shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getDrives: () => ipcRenderer.invoke('get-drives'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (path: string, includeHidden?: boolean) =>
    ipcRenderer.invoke('scan-directory', path, includeHidden),
  getTopFiles: (count?: number) => ipcRenderer.invoke('get-top-files', count),
  exportReport: () => ipcRenderer.invoke('export-report'),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  expandDirectory: (path: string) => ipcRenderer.invoke('expand-directory', path),
  revealInFolder: (path: string) => ipcRenderer.invoke('reveal-in-folder', path),
  moveToTrash: (path: string) => ipcRenderer.invoke('move-to-trash', path),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_event: any, progress: ScanProgress) => callback(progress)
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
})
