import { contextBridge, ipcRenderer } from 'electron'
import type { FileNode, ScanProgress } from '../src/shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getDrives: () => ipcRenderer.invoke('get-drives'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (path: string, includeHidden?: boolean, excludePatterns?: string[]) =>
    ipcRenderer.invoke('scan-directory', path, includeHidden, excludePatterns),
  getTopFiles: (count?: number) => ipcRenderer.invoke('get-top-files', count),
  exportReport: () => ipcRenderer.invoke('export-report'),
  getCategoryBreakdown: (path?: string) => ipcRenderer.invoke('get-category-breakdown', path),
  searchFiles: (query: string, limit?: number) => ipcRenderer.invoke('search-files', query, limit),
  findDuplicates: () => ipcRenderer.invoke('find-duplicates'),
  getCleanupSuggestions: () => ipcRenderer.invoke('get-cleanup-suggestions'),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  expandDirectory: (path: string) => ipcRenderer.invoke('expand-directory', path),
  revealInFolder: (path: string) => ipcRenderer.invoke('reveal-in-folder', path),
  moveToTrash: (path: string) => ipcRenderer.invoke('move-to-trash', path),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_event: any, progress: ScanProgress) => callback(progress)
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
  onDuplicatesProgress: (callback: (progress: { hashed: number }) => void) => {
    const handler = (_event: any, progress: { hashed: number }) => callback(progress)
    ipcRenderer.on('duplicates-progress', handler)
    return () => ipcRenderer.removeListener('duplicates-progress', handler)
  },
})
