export interface FileNode {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
  /** Present when children were omitted from the IPC payload; indicates the real child count. */
  childCount?: number
  /** True when the directory could not be read (usually a permissions error). */
  inaccessible?: boolean
  /** Last-modified time in ms since epoch (files only). */
  mtime?: number
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
