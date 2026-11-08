import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ScanProgress } from '../src/shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setLanguage: (language: string) => ipcRenderer.invoke('set-language', language),
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
    const handler = (_event: IpcRendererEvent, progress: ScanProgress) => callback(progress)
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
  onMenuCommand: (callback: (command: string) => void) => {
    const handler = (_event: IpcRendererEvent, command: string) => callback(command)
    ipcRenderer.on('menu-command', handler)
    return () => ipcRenderer.removeListener('menu-command', handler)
  },
  onDuplicatesProgress: (callback: (progress: { hashed: number }) => void) => {
    const handler = (_event: IpcRendererEvent, progress: { hashed: number }) => callback(progress)
    ipcRenderer.on('duplicates-progress', handler)
    return () => ipcRenderer.removeListener('duplicates-progress', handler)
  },
})
