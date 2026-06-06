export type { DiskInfo, FileNode, ScanProgress } from './shared/types'

import type { FileNode, DiskInfo, ScanProgress } from './shared/types'

export interface ElectronAPI {
  getDrives: () => Promise<DiskInfo[]>
  selectDirectory: () => Promise<string | null>
  scanDirectory: (path: string) => Promise<FileNode | null>
  cancelScan: () => Promise<void>
  expandDirectory: (path: string) => Promise<FileNode[] | null>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
