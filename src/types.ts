export interface FileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

export interface ScanProgress {
  scanned: number
  currentPath: string
}

export interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  scanDirectory: (path: string) => Promise<FileNode | null>
  cancelScan: () => Promise<void>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
