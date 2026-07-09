export type { DiskInfo, FileNode, ScanProgress } from './shared/types'

import type { FileNode, DiskInfo, ScanProgress } from './shared/types'

export interface ElectronAPI {
  /** Node's process.platform ('darwin', 'win32', 'linux', …). */
  platform: string
  getDrives: () => Promise<DiskInfo[]>
  selectDirectory: () => Promise<string | null>
  scanDirectory: (path: string, includeHidden?: boolean) => Promise<FileNode | null>
  getTopFiles: (count?: number) => Promise<FileNode[] | null>
  cancelScan: () => Promise<void>
  expandDirectory: (path: string) => Promise<FileNode[] | null>
  revealInFolder: (path: string) => Promise<void>
  moveToTrash: (path: string) => Promise<boolean>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
