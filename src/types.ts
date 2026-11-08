export type { DiskInfo, FileNode, ScanProgress, DuplicateGroup, CleanupSuggestion } from './shared/types'
export type { CategoryBreakdown } from './shared/categories'

import type { FileNode, DiskInfo, ScanProgress, DuplicateGroup, CleanupSuggestion } from './shared/types'
import type { CategoryBreakdown } from './shared/categories'

export interface ElectronAPI {
  /** Node's process.platform ('darwin', 'win32', 'linux', …). */
  platform: string
  /** Tells the main process the UI language so the native menu follows it. */
  setLanguage: (language: 'en' | 'es') => Promise<void>
  getDrives: () => Promise<DiskInfo[]>
  selectDirectory: () => Promise<string | null>
  scanDirectory: (path: string, includeHidden?: boolean, excludePatterns?: string[]) => Promise<FileNode | null>
  getTopFiles: (count?: number) => Promise<FileNode[] | null>
  exportReport: () => Promise<string | null>
  getCategoryBreakdown: (path?: string) => Promise<CategoryBreakdown[] | null>
  searchFiles: (query: string, limit?: number) => Promise<FileNode[] | null>
  findDuplicates: () => Promise<DuplicateGroup[] | null>
  getCleanupSuggestions: () => Promise<CleanupSuggestion[] | null>
  cancelScan: () => Promise<void>
  expandDirectory: (path: string) => Promise<FileNode[] | null>
  revealInFolder: (path: string) => Promise<void>
  moveToTrash: (path: string) => Promise<boolean>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
  onDuplicatesProgress: (callback: (progress: { hashed: number }) => void) => () => void
  /** Commands from the native menu (e.g. 'select-folder'). Returns an unsubscribe function. */
  onMenuCommand: (callback: (command: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
