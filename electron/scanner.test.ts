import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { FileNode } from '../src/shared/types'
import {
  buildShallowTree,
  collectJunkDirs,
  collectTopFiles,
  findDuplicateGroups,
  findNodeByPath,
  getDisplayNameForPath,
  removeNode,
  scanDir,
  searchTree,
} from './scanner'

let root: string

/** Writes a file of `size` bytes whose content is derived from `seed` (same seed => same bytes). */
function write(rel: string, size: number, seed = rel) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, Buffer.alloc(size, seed.charCodeAt(0) % 251))
}

const noProgress = () => {}
const scan = (opts: { hidden?: boolean; exclude?: string[] } = {}) =>
  scanDir(root, new AbortController().signal, noProgress, opts.hidden ?? false, undefined, opts.exclude ?? [])

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'greekdir-test-'))
  write('a/big.bin', 9000, 'x')
  write('a/small.txt', 10, 's')
  write('b/copy-of-big.bin', 9000, 'x') // same content as a/big.bin
  write('b/other.bin', 9000, 'y') // same size, different content
  write('b/unique.bin', 5000, 'z')
  write('node_modules/pkg/index.js', 3000, 'n')
  write('.hidden/secret.txt', 100, 'h')
  write('skipme/data.bin', 2000, 'd')
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('scanDir', () => {
  it('sums sizes and sorts children by size, largest first', async () => {
    const tree = await scan()
    const expectedTotal = 9000 + 10 + 9000 + 9000 + 5000 + 2000 // no node_modules, no .hidden
    expect(tree.size).toBe(expectedTotal)
    const sizes = tree.children!.map((c) => c.size)
    expect(sizes).toEqual([...sizes].sort((p, q) => q - p))
    expect(tree.children!.map((c) => c.name)).not.toContain('node_modules')
    expect(tree.children!.map((c) => c.name)).not.toContain('.hidden')
  })

  it('includes hidden and system folders when asked', async () => {
    const tree = await scan({ hidden: true })
    const names = tree.children!.map((c) => c.name)
    expect(names).toContain('node_modules')
    expect(names).toContain('.hidden')
    expect(tree.size).toBe(9000 + 10 + 9000 + 9000 + 5000 + 3000 + 100 + 2000)
  })

  it('skips user-excluded folders case-insensitively, even with hidden enabled', async () => {
    const tree = await scan({ hidden: true, exclude: ['SkipMe'] })
    expect(tree.children!.map((c) => c.name)).not.toContain('skipme')
  })

  it('records extension and mtime on files, and none on folders', async () => {
    const tree = await scan()
    const file = findNodeByPath(tree, path.join(root, 'a', 'big.bin'))!
    expect(file.extension).toBe('.bin')
    expect(typeof file.mtime).toBe('number')
    expect(findNodeByPath(tree, path.join(root, 'a'))!.extension).toBeUndefined()
  })

  it('throws AbortError when cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(scanDir(root, controller.signal, noProgress)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('flags unreadable directories instead of failing', async () => {
    const tree = await scanDir(path.join(root, 'does-not-exist'), new AbortController().signal, noProgress)
    expect(tree.inaccessible).toBe(true)
    expect(tree.size).toBe(0)
  })
})

describe('tree helpers', () => {
  it('buildShallowTree cuts at the depth limit and records childCount', async () => {
    const tree = await scan()
    const shallow = buildShallowTree(tree, 0, 1)
    const dirA = shallow.children!.find((c) => c.name === 'a')!
    expect(dirA.children).toBeUndefined()
    expect(dirA.childCount).toBe(2)
    expect(dirA.size).toBe(9010)
  })

  it('findNodeByPath finds nested nodes and returns null for unknown paths', async () => {
    const tree = await scan()
    expect(findNodeByPath(tree, path.join(root, 'b', 'unique.bin'))?.size).toBe(5000)
    expect(findNodeByPath(tree, path.join(root, 'nope', 'x'))).toBeNull()
    expect(findNodeByPath(tree, root)).toBe(tree)
  })

  it('collectTopFiles returns the largest files first', async () => {
    const tree = await scan()
    const top = collectTopFiles(tree, 3)
    expect(top).toHaveLength(3)
    expect(top[0].size).toBe(9000)
    expect(top.map((f) => f.size)).toEqual([...top.map((f) => f.size)].sort((p, q) => q - p))
  })

  it('searchTree matches case-insensitively and strips children from directories', async () => {
    const tree = await scan()
    const hits = searchTree(tree, 'BIG', 10)
    expect(hits.map((h) => h.name).sort()).toEqual(['big.bin', 'copy-of-big.bin'])
    const dirHit = searchTree(tree, 'a', 100).find((h) => h.name === 'a')!
    expect(dirHit.children).toBeUndefined()
    expect(dirHit.childCount).toBe(2)
    expect(searchTree(tree, '   ', 10)).toEqual([])
  })

  it('collectJunkDirs finds known junk folders and does not descend into them', async () => {
    const tree = await scan({ hidden: true })
    const junk = collectJunkDirs(tree)
    expect(junk.map((j) => j.name)).toEqual(['node_modules'])
    expect(junk[0].size).toBe(3000)
  })

  it('getDisplayNameForPath names drive roots and folders sensibly', () => {
    expect(getDisplayNameForPath(path.join(root, 'a'))).toBe('a')
    expect(getDisplayNameForPath(path.parse(root).root)).toBe(path.parse(root).root)
  })
})

describe('removeNode', () => {
  it('removes the node and subtracts its size from every ancestor', async () => {
    const tree = await scan()
    const before = tree.size
    const target = path.join(root, 'a', 'big.bin')
    const removed = removeNode(tree, target)
    expect(removed?.size).toBe(9000)
    expect(findNodeByPath(tree, target)).toBeNull()
    expect(findNodeByPath(tree, path.join(root, 'a'))!.size).toBe(10)
    expect(tree.size).toBe(before - 9000)
  })

  it('removes a whole directory with its subtree', async () => {
    const tree = await scan()
    const before = tree.size
    expect(removeNode(tree, path.join(root, 'b'))?.size).toBe(9000 + 9000 + 5000)
    expect(tree.size).toBe(before - 23000)
    expect(collectTopFiles(tree, 100).some((f) => f.path.includes(`${path.sep}b${path.sep}`))).toBe(false)
  })

  it('never removes the root, and returns null for unknown paths', async () => {
    const tree = await scan()
    expect(removeNode(tree, root)).toBeNull()
    expect(removeNode(tree, path.join(root, 'ghost'))).toBeNull()
    expect(tree.size).toBe(9000 + 10 + 9000 + 9000 + 5000 + 2000)
  })

  it('removing twice is harmless (second call finds nothing)', async () => {
    const tree = await scan()
    const target = path.join(root, 'b', 'unique.bin')
    expect(removeNode(tree, target)).not.toBeNull()
    expect(removeNode(tree, target)).toBeNull()
  })
})

describe('findDuplicateGroups', () => {
  it('groups identical content and ignores same-size files with different content', async () => {
    const tree = await scan()
    const groups = await findDuplicateGroups(tree)
    expect(groups).toHaveLength(1)
    expect(groups[0].size).toBe(9000)
    expect(groups[0].files.map((f) => f.name).sort()).toEqual(['big.bin', 'copy-of-big.bin'])
  })

  it('ignores files below the minimum size', async () => {
    const tree = await scan()
    expect(await findDuplicateGroups(tree, { minSize: 10_000 })).toEqual([])
  })

  it('respects the hash budget', async () => {
    const tree = await scan()
    expect(await findDuplicateGroups(tree, { hashBudget: 1 })).toEqual([])
  })

  it('skips files that can no longer be read instead of failing', async () => {
    const tree = await scan()
    const ghost: FileNode = { name: 'ghost.bin', path: path.join(root, 'ghost.bin'), size: 9000, isDirectory: false, extension: '.bin' }
    tree.children!.push(ghost)
    const groups = await findDuplicateGroups(tree)
    expect(groups.flatMap((g) => g.files.map((f) => f.name))).not.toContain('ghost.bin')
    expect(groups).toHaveLength(1)
  })

  it('reports progress', async () => {
    const tree = await scan()
    const seen: number[] = []
    await findDuplicateGroups(tree, { onProgress: (n) => seen.push(n) })
    expect(seen.every((n) => n % 25 === 0)).toBe(true) // only reported in batches
  })
})
