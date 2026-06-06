export interface FileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
}

export interface DiskInfo {
  name: string
  path: string
  totalSize: number
  freeSpace: number
  usedSpace: number
  filesystem?: string
}

export interface ScanProgress {
  scanned: number
  currentPath: string
}

export interface ElectronAPI {
  getDrives: () => Promise<DiskInfo[]>
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
