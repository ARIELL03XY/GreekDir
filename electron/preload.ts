import { contextBridge, ipcRenderer } from 'electron'

export interface ScanProgress {
  scanned: number
  currentPath: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (path: string) => ipcRenderer.invoke('scan-directory', path),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_event: any, progress: ScanProgress) => callback(progress)
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
})
