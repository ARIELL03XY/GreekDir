/**
 * Pure scanning / tree logic for the main process. It deliberately imports nothing from
 * `electron` so it can be unit-tested with plain Node (see electron/scanner.test.ts).
 */
import path from 'path'
import fs from 'fs'
import crypto from 'node:crypto'
import type { FileNode, ScanProgress, DuplicateGroup, CleanupSuggestion } from '../src/shared/types'

/** Directory names skipped during scans on every platform. */
export const SKIPPED_DIR_NAMES = new Set(['node_modules', '$Recycle.Bin', 'System Volume Information'])

/**
 * Absolute paths skipped during scans on macOS: /System/Volumes contains the
 * Data volume (already counted via firmlinks such as /Users and /Applications)
 * and /Volumes holds external drives, which should be scanned individually.
 */
export const DARWIN_SKIPPED_PATHS = new Set(['/System/Volumes', '/Volumes', '/dev'])

export function getDisplayNameForPath(dirPath: string): string {
  const parsedRoot = path.parse(dirPath).root
  const normalizedPath = dirPath.replace(/[\\/]+$/, '')
  const normalizedRoot = parsedRoot.replace(/[\\/]+$/, '')

  if (
    dirPath === parsedRoot ||
    normalizedPath === normalizedRoot ||
    normalizedPath.length === 0
  ) {
    return parsedRoot || dirPath
  }

  return path.basename(normalizedPath) || dirPath
}

export async function scanDir(
  dirPath: string,
  signal: AbortSignal,
  onProgress: (info: ScanProgress) => void,
  includeHidden = false,
  counter = { count: 0 },
  excludePatterns: string[] = []
): Promise<FileNode> {
  if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

  const name = getDisplayNameForPath(dirPath)
  const node: FileNode = {
    name,
    path: dirPath,
    size: 0,
    isDirectory: true,
    children: [],
  }

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  } catch {
    // Typically a permissions error (e.g. macOS TCC-protected folders).
    // Flag it so the renderer can tell the user why the size reads 0.
    node.inaccessible = true
    return node
  }

  for (const entry of entries) {
    if (signal.aborted) throw new DOMException('Scan cancelled', 'AbortError')

    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // Skip hidden/system directories unless the user opted in.
      if (!includeHidden && (entry.name.startsWith('.') || SKIPPED_DIR_NAMES.has(entry.name))) {
        continue
      }
      // Skip directories the user explicitly excluded (independent of includeHidden).
      if (excludePatterns.some((pattern) => pattern.toLowerCase() === entry.name.toLowerCase())) {
        continue
      }
      // On macOS, skip mount points that would double-count data (the Data
      // volume is already reachable through firmlinks like /Users) or pull in
      // external drives when scanning from the root. Never optional: these
      // would corrupt totals, not just hide detail.
      if (process.platform === 'darwin' && DARWIN_SKIPPED_PATHS.has(fullPath)) {
        continue
      }
      const childNode = await scanDir(fullPath, signal, onProgress, includeHidden, counter, excludePatterns)
      node.children!.push(childNode)
      node.size += childNode.size
    } else if (entry.isFile()) {
      try {
        const stats = await fs.promises.stat(fullPath)
        const ext = path.extname(entry.name).toLowerCase()
        node.children!.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          isDirectory: false,
          extension: ext,
          mtime: stats.mtimeMs,
        })
        node.size += stats.size
      } catch {
        // Skip files we can't read
      }
    }

    counter.count++
    if (counter.count % 100 === 0) {
      onProgress({ scanned: counter.count, currentPath: fullPath })
      // Yield to the event loop between batches so IPC/UI messages are processed.
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }

  // Sort children by size descending
  node.children!.sort((a, b) => b.size - a.size)

  return node
}

/**
 * Returns a copy of `node` that only includes children up to `maxDepth` levels
 * below the current depth. Directories that are cut off keep their `size` and
 * receive a `childCount` field so the renderer knows they can be expanded.
 */
export function buildShallowTree(node: FileNode, currentDepth: number, maxDepth: number): FileNode {
  if (!node.isDirectory || !node.children) {
    return node
  }

  if (currentDepth >= maxDepth) {
    // Omit children but record how many there are so the renderer can lazy-load.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...rest } = node
    return { ...rest, childCount: node.children.length }
  }

  return {
    ...node,
    children: node.children.map((child) => buildShallowTree(child, currentDepth + 1, maxDepth)),
  }
}

/** The child of `parent` that is, or contains, `targetPath` (child paths are built with path.join). */
function childContaining(parent: FileNode, targetPath: string): FileNode | null {
  return (
    parent.children?.find(
      (c) =>
        c.path === targetPath ||
        (targetPath.startsWith(c.path) &&
          (c.path.endsWith(path.sep) || targetPath[c.path.length] === path.sep))
    ) ?? null
  )
}

/**
 * Finds the node in `root` whose `path` matches `targetPath`.
 * Descends by path prefix instead of walking every node — O(depth × siblings)
 * rather than O(total nodes), which matters on multi-million-file scans. Falls
 * back to a full search if the prefix descent dead-ends.
 */
export function findNodeByPath(root: FileNode, targetPath: string): FileNode | null {
  let node: FileNode | null = root
  while (node) {
    if (node.path === targetPath) return node
    node = childContaining(node, targetPath)
  }
  return findNodeByPathSlow(root, targetPath)
}

function findNodeByPathSlow(root: FileNode, targetPath: string): FileNode | null {
  if (root.path === targetPath) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNodeByPathSlow(child, targetPath)
    if (found) return found
  }
  return null
}

/**
 * Removes the node at `targetPath` from the tree and subtracts its size from every
 * ancestor, so later queries (top files, duplicates, cleanup, search) no longer see
 * something that has been moved to the trash. The root itself is never removed.
 * Returns the removed node, or null if it was not found.
 */
export function removeNode(root: FileNode, targetPath: string): FileNode | null {
  if (root.path === targetPath) return null
  const trail: FileNode[] = []
  let node: FileNode | null = root
  while (node && node.path !== targetPath) {
    trail.push(node)
    node = childContaining(node, targetPath)
  }
  if (!node) return null

  const parent = trail[trail.length - 1]
  const index = parent.children ? parent.children.indexOf(node) : -1
  if (index < 0) return null
  parent.children!.splice(index, 1)
  for (const ancestor of trail) ancestor.size = Math.max(0, ancestor.size - node.size)
  return node
}

/** The `count` largest files of the whole tree, size-descending. Iterative — trees can hold millions of nodes. */
export function collectTopFiles(root: FileNode, count: number): FileNode[] {
  const files: FileNode[] = []
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.isDirectory) {
      if (node.children) stack.push(...node.children)
    } else {
      files.push(node)
    }
  }
  files.sort((a, b) => b.size - a.size)
  return files.slice(0, count)
}

/**
 * Case-insensitive name search over the whole tree, largest first. Directory matches are
 * returned without their children to keep the IPC payload small.
 */
export function searchTree(root: FileNode, query: string, limit: number): FileNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const matches: FileNode[] = []
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.name.toLowerCase().includes(needle)) {
      matches.push(
        node.isDirectory
          ? { ...node, children: undefined, childCount: node.children?.length ?? node.childCount }
          : node
      )
    }
    if (node.children) stack.push(...node.children)
  }

  matches.sort((a, b) => b.size - a.size)
  return matches.slice(0, limit)
}

/** Directory names recognized as safe-to-review cleanup candidates (build artifacts, caches, deps). */
export const JUNK_DIR_NAMES = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache',
  '__pycache__', '.pytest_cache', '.tox', '.venv', 'venv', '.gradle', 'target',
  'coverage', '.parcel-cache', '.angular', '.svelte-kit',
])

/**
 * Walks the tree looking for directories matching JUNK_DIR_NAMES. Stops descending once a
 * match is found (no point reporting nested matches inside e.g. node_modules). Only sees
 * what the scan actually walked — most of these names are skipped by the scan itself
 * unless "include hidden" was on.
 */
export function collectJunkDirs(root: FileNode): CleanupSuggestion[] {
  const results: CleanupSuggestion[] = []
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (!node.isDirectory) continue
    if (JUNK_DIR_NAMES.has(node.name)) {
      results.push({ path: node.path, name: node.name, size: node.size, pattern: node.name })
      continue
    }
    if (node.children) stack.push(...node.children)
  }
  results.sort((a, b) => b.size - a.size)
  return results.slice(0, 100)
}

/** Streams a file's content through MD5 without loading it fully into memory. */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/** Files smaller than this are ignored by the duplicate finder — too many, too little payoff. */
export const MIN_DUPLICATE_SIZE = 4096
/** Upper bound on how many files we'll actually hash per search, so a huge drive can't hang it. */
export const DUPLICATE_HASH_BUDGET = 8000

export interface DuplicateOptions {
  minSize?: number
  hashBudget?: number
  onProgress?: (hashed: number) => void
}

/**
 * Finds duplicate files across the whole tree. Groups files by size first (cheap), then
 * hashes only the size-groups with the most potential wasted space first, up to a hash
 * budget, so this stays fast on drives with hundreds of thousands of files.
 */
export async function findDuplicateGroups(
  root: FileNode,
  { minSize = MIN_DUPLICATE_SIZE, hashBudget = DUPLICATE_HASH_BUDGET, onProgress }: DuplicateOptions = {}
): Promise<DuplicateGroup[]> {
  const bySize = new Map<number, FileNode[]>()
  const stack: FileNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.isDirectory) {
      if (node.children) stack.push(...node.children)
    } else if (node.size >= minSize) {
      const group = bySize.get(node.size)
      if (group) group.push(node)
      else bySize.set(node.size, [node])
    }
  }

  const candidateGroups = [...bySize.values()]
    .filter((files) => files.length > 1)
    .sort((a, b) => b[0].size * (b.length - 1) - a[0].size * (a.length - 1))

  const results: DuplicateGroup[] = []
  let hashed = 0

  for (const group of candidateGroups) {
    if (hashed >= hashBudget) break

    const byHash = new Map<string, FileNode[]>()
    for (const file of group) {
      if (hashed >= hashBudget) break
      try {
        const hash = await hashFile(file.path)
        const existing = byHash.get(hash)
        if (existing) existing.push(file)
        else byHash.set(hash, [file])
      } catch {
        // Unreadable (permissions, locked file, etc.) — skip it.
      }
      hashed++
      if (hashed % 25 === 0) onProgress?.(hashed)
    }

    for (const [hash, files] of byHash) {
      if (files.length > 1) {
        results.push({ hash, size: files[0].size, files })
      }
    }
  }

  results.sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1))
  return results.slice(0, 200)
}
