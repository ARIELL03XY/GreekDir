/**
 * Electron-free helpers for the Clean Up actions (open, move, trash size), kept apart from
 * main.ts so they can be unit-tested with plain Node.
 */
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/**
 * Extensions that run code when opened (Windows runs them with a double-click, macOS/Linux
 * launch scripts and app bundles). Opening one of these asks for confirmation first.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  // Windows
  '.exe', '.com', '.bat', '.cmd', '.msi', '.msix', '.msp', '.appx', '.appxbundle', '.scr', '.pif', '.cpl',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.ps1', '.psm1', '.reg', '.lnk', '.url', '.jar',
  '.application', '.gadget', '.inf', '.msc', '.settingcontent-ms',
  // macOS / Linux
  '.app', '.command', '.sh', '.bash', '.zsh', '.csh', '.run', '.bin', '.appimage', '.desktop', '.pkg',
  '.workflow', '.terminal', '.tool',
])

/** True if opening `filePath` would run a program or script rather than show a document. */
export function isExecutablePath(filePath: string): boolean {
  return EXECUTABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

export type MovePlan =
  | { ok: true; destination: string }
  | { ok: false; reason: 'same-folder' | 'inside-source' | 'exists' }

const samePath = (a: string, b: string, platform: NodeJS.Platform) =>
  platform === 'win32' || platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b

/**
 * Where `source` would end up when moved into `targetDir`, or why it cannot be moved there.
 * Never overwrites: an existing item with the same name is a refusal.
 */
export function planMove(source: string, targetDir: string, platform: NodeJS.Platform = process.platform): MovePlan {
  // Path rules of the given platform (so Windows paths are handled as such wherever this runs).
  const p = platform === 'win32' ? path.win32 : path.posix
  const from = p.resolve(source)
  const into = p.resolve(targetDir)
  if (samePath(p.dirname(from), into, platform)) return { ok: false, reason: 'same-folder' }
  const inside = samePath(into, from, platform) || samePath(into.slice(0, from.length + 1), from + p.sep, platform)
  if (inside) return { ok: false, reason: 'inside-source' }
  const destination = p.join(into, p.basename(from))
  if (fs.existsSync(destination)) return { ok: false, reason: 'exists' }
  return { ok: true, destination }
}

/** Thrown when the copy to another drive succeeded but the original could not be deleted. */
export class SourceNotRemovedError extends Error {
  constructor(readonly destination: string, readonly original: unknown) {
    super(`Copied to ${destination} but the original could not be removed`)
  }
}

type RenameFn = (from: string, to: string) => Promise<void>

/**
 * Moves a file or folder. A rename across drives fails with EXDEV; then the item is copied
 * (never overwriting) and the original deleted. A failed copy removes the partial copy and
 * leaves the original untouched.
 */
export async function moveItem(source: string, destination: string, rename: RenameFn = fs.promises.rename): Promise<void> {
  try {
    await rename(source, destination)
    return
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
  }
  try {
    await fs.promises.cp(source, destination, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true })
  } catch (err) {
    await fs.promises.rm(destination, { recursive: true, force: true }).catch(() => {})
    throw err
  }
  try {
    await fs.promises.rm(source, { recursive: true })
  } catch (err) {
    throw new SourceNotRemovedError(destination, err)
  }
}

// ---------------------------------------------------------------------------
// Trash / Recycle Bin size
// ---------------------------------------------------------------------------

export interface TrashInfo {
  items: number
  size: number
}

/** Total size of a file or folder (symlinks are not followed; unreadable entries count as 0). */
export async function pathSize(target: string): Promise<number> {
  let total = 0
  const stack = [target]
  while (stack.length > 0) {
    const current = stack.pop()!
    let stat: fs.Stats
    try {
      stat = await fs.promises.lstat(current)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      try {
        for (const name of await fs.promises.readdir(current)) stack.push(path.join(current, name))
      } catch {
        // Unreadable folder: skip its contents.
      }
    } else if (stat.isFile()) {
      total += stat.size
    }
  }
  return total
}

/**
 * Size of the Windows Recycle Bin for one user, given that user's folder on each drive
 * (`X:\$Recycle.Bin\<SID>`). Each deleted item is a `$R…` entry (the data) paired with a
 * `$I…` entry (its metadata); only complete pairs count, as in Explorer.
 */
export async function measureWindowsRecycleBin(userBinDirs: string[]): Promise<TrashInfo> {
  const info: TrashInfo = { items: 0, size: 0 }
  for (const dir of userBinDirs) {
    let names: string[]
    try {
      names = await fs.promises.readdir(dir)
    } catch {
      continue
    }
    const metadata = new Set(names.filter((n) => n.startsWith('$I')).map((n) => n.slice(2)))
    for (const name of names) {
      if (!name.startsWith('$R') || !metadata.has(name.slice(2))) continue
      info.items += 1
      info.size += await pathSize(path.join(dir, name))
    }
  }
  return info
}

/**
 * Size of a trash folder whose entries are the deleted items (macOS `~/.Trash`, Linux `Trash/files`).
 * Null when the folder cannot be read (macOS needs Full Disk Access for `~/.Trash`), so the menu
 * does not claim the trash is empty. A missing folder means an empty trash.
 */
export async function measureTrashFolder(dir: string): Promise<TrashInfo | null> {
  const info: TrashInfo = { items: 0, size: 0 }
  let names: string[]
  try {
    names = await fs.promises.readdir(dir)
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? info : null
  }
  for (const name of names) {
    if (name === '.DS_Store' || name === '.localized') continue
    info.items += 1
    info.size += await pathSize(path.join(dir, name))
  }
  return info
}
