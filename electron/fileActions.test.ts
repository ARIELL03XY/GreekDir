import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isExecutablePath,
  measureTrashFolder,
  measureWindowsRecycleBin,
  moveItem,
  pathSize,
  planMove,
  SourceNotRemovedError,
} from './fileActions'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'greekdir-actions-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function write(rel: string, bytes: number) {
  const file = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.alloc(bytes))
  return file
}

describe('isExecutablePath', () => {
  it('flags programs and scripts, case-insensitively', () => {
    for (const p of ['C:\\x\\setup.EXE', 'C:\\x\\run.bat', '/x/script.PS1', '/x/install.sh', '/Applications/Foo.app', '/x/a.lnk']) {
      expect(isExecutablePath(p), p).toBe(true)
    }
  })

  it('does not flag documents, media or folders without an extension', () => {
    for (const p of ['C:\\x\\report.pdf', '/x/photo.jpg', '/x/movie.mkv', '/x/notes.txt', '/x/folder', '/x/archive.zip']) {
      expect(isExecutablePath(p), p).toBe(false)
    }
  })
})

describe('planMove', () => {
  it('moves into another folder under the same name', () => {
    const src = write('a/big.iso', 1)
    fs.mkdirSync(path.join(tmp, 'b'))
    expect(planMove(src, path.join(tmp, 'b'))).toEqual({ ok: true, destination: path.join(tmp, 'b', 'big.iso') })
  })

  it('refuses the folder it is already in', () => {
    const src = write('a/big.iso', 1)
    expect(planMove(src, path.join(tmp, 'a'))).toEqual({ ok: false, reason: 'same-folder' })
  })

  it('refuses moving a folder into itself or one of its subfolders', () => {
    fs.mkdirSync(path.join(tmp, 'a/sub'), { recursive: true })
    expect(planMove(path.join(tmp, 'a'), path.join(tmp, 'a'))).toEqual({ ok: false, reason: 'inside-source' })
    expect(planMove(path.join(tmp, 'a'), path.join(tmp, 'a/sub'))).toEqual({ ok: false, reason: 'inside-source' })
  })

  it('does not confuse a sibling with a common prefix for a subfolder', () => {
    fs.mkdirSync(path.join(tmp, 'a'))
    fs.mkdirSync(path.join(tmp, 'ab'))
    expect(planMove(path.join(tmp, 'a'), path.join(tmp, 'ab')).ok).toBe(true)
  })

  it('never overwrites an existing item', () => {
    const src = write('a/big.iso', 1)
    write('b/big.iso', 1)
    expect(planMove(src, path.join(tmp, 'b'))).toEqual({ ok: false, reason: 'exists' })
  })

  it('compares paths case-insensitively on Windows and macOS only', () => {
    expect(planMove('C:\\Data\\file.txt', 'c:\\data', 'win32')).toEqual({ ok: false, reason: 'same-folder' })
    expect(planMove('C:\\Data', 'c:\\data\\Sub', 'win32')).toEqual({ ok: false, reason: 'inside-source' })
    expect(planMove('/data/file.txt', '/data', 'linux')).toEqual({ ok: false, reason: 'same-folder' })
    expect(planMove('/Data/file.txt', '/data', 'linux').ok).toBe(true)
  })
})

describe('moveItem', () => {
  it('renames on the same drive', async () => {
    const src = write('a/f.bin', 10)
    const dest = path.join(tmp, 'b', 'f.bin')
    fs.mkdirSync(path.dirname(dest))
    await moveItem(src, dest)
    expect(fs.existsSync(src)).toBe(false)
    expect(fs.statSync(dest).size).toBe(10)
  })

  it('copies then deletes when the rename crosses drives (EXDEV)', async () => {
    write('a/dir/one.bin', 3)
    write('a/dir/nested/two.bin', 4)
    const src = path.join(tmp, 'a/dir')
    const dest = path.join(tmp, 'b/dir')
    fs.mkdirSync(path.join(tmp, 'b'))
    const exdev = async () => {
      throw Object.assign(new Error('cross-device'), { code: 'EXDEV' })
    }
    await moveItem(src, dest, exdev)
    expect(fs.existsSync(src)).toBe(false)
    expect(await pathSize(dest)).toBe(7)
  })

  it('rethrows other rename errors and leaves the source alone', async () => {
    const src = write('a/f.bin', 1)
    const denied = async () => {
      throw Object.assign(new Error('denied'), { code: 'EPERM' })
    }
    await expect(moveItem(src, path.join(tmp, 'f.bin'), denied)).rejects.toThrow('denied')
    expect(fs.existsSync(src)).toBe(true)
  })

  it('reports when the copy succeeded but the original could not be deleted', async () => {
    const src = write('a/f.bin', 1)
    const dest = path.join(tmp, 'b.bin')
    const exdev = async () => {
      throw Object.assign(new Error('cross-device'), { code: 'EXDEV' })
    }
    const rm = fs.promises.rm
    fs.promises.rm = async (p, opts) => {
      if (p === src) throw new Error('in use')
      return rm(p, opts)
    }
    try {
      await expect(moveItem(src, dest, exdev)).rejects.toBeInstanceOf(SourceNotRemovedError)
    } finally {
      fs.promises.rm = rm
    }
    expect(fs.existsSync(dest)).toBe(true)
  })
})

describe('trash size', () => {
  it('counts only complete $R/$I pairs in the Windows Recycle Bin', async () => {
    const bin = path.join(tmp, 'C', '$Recycle.Bin', 'S-1-5-21-1')
    write('C/$Recycle.Bin/S-1-5-21-1/$RAAA.iso', 100)
    write('C/$Recycle.Bin/S-1-5-21-1/$IAAA.iso', 40)
    write('C/$Recycle.Bin/S-1-5-21-1/$RBBB/inner/x.bin', 20)
    write('C/$Recycle.Bin/S-1-5-21-1/$IBBB', 40)
    write('C/$Recycle.Bin/S-1-5-21-1/$IORPHAN', 40) // metadata without data
    write('C/$Recycle.Bin/S-1-5-21-1/desktop.ini', 5)
    const missingDrive = path.join(tmp, 'Z', '$Recycle.Bin', 'S-1-5-21-1')
    expect(await measureWindowsRecycleBin([bin, missingDrive])).toEqual({ items: 2, size: 120 })
  })

  it('measures a trash folder, ignoring Finder metadata', async () => {
    write('Trash/files/a.txt', 7)
    write('Trash/files/dir/b.txt', 3)
    write('Trash/files/.DS_Store', 99)
    expect(await measureTrashFolder(path.join(tmp, 'Trash/files'))).toEqual({ items: 2, size: 10 })
  })

  it('treats a missing trash folder as empty', async () => {
    expect(await measureTrashFolder(path.join(tmp, 'nope'))).toEqual({ items: 0, size: 0 })
  })
})
