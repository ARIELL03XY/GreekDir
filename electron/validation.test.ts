import { describe, expect, it } from 'vitest'
import path from 'path'
import { asInt, asPath, asPathOrNull, asQuery, asStringList, isFilesystemRoot } from './validation'

const abs = path.resolve('some', 'folder')

describe('asPath', () => {
  it('accepts absolute paths', () => {
    expect(asPath(abs)).toBe(abs)
  })

  it.each([
    ['relative path', 'folder/file.txt'],
    ['empty string', ''],
    ['NUL byte', abs + '\0.txt'],
    ['number', 42],
    ['object', { path: abs }],
    ['null', null],
    ['undefined', undefined],
    ['array', [abs]],
    ['too long', path.resolve('x') + 'a'.repeat(40000)],
  ])('rejects %s', (_label, value) => {
    expect(() => asPath(value)).toThrow(/Invalid/)
    expect(asPathOrNull(value)).toBeNull()
  })
})

describe('asInt', () => {
  it('clamps and truncates', () => {
    expect(asInt(5.9, 1, 0, 10)).toBe(5)
    expect(asInt(-3, 1, 0, 10)).toBe(0)
    expect(asInt(99999, 1, 0, 1000)).toBe(1000)
  })

  it('falls back on non-numbers and non-finite values', () => {
    expect(asInt('7', 100, 1, 1000)).toBe(100)
    expect(asInt(NaN, 100, 1, 1000)).toBe(100)
    expect(asInt(Infinity, 100, 1, 1000)).toBe(100)
    expect(asInt(undefined, 100, 1, 1000)).toBe(100)
  })
})

describe('asStringList', () => {
  it('keeps only bounded, non-empty strings', () => {
    expect(asStringList(['a', '', 5, null, 'b', 'x'.repeat(300)])).toEqual(['a', 'b'])
  })

  it('caps the number of items and rejects non-arrays', () => {
    expect(asStringList(Array.from({ length: 500 }, (_, i) => `n${i}`))).toHaveLength(200)
    expect(asStringList('node_modules')).toEqual([])
    expect(asStringList(undefined)).toEqual([])
  })
})

describe('asQuery', () => {
  it('truncates long strings and neutralises non-strings', () => {
    expect(asQuery('hello')).toBe('hello')
    expect(asQuery('x'.repeat(1000))).toHaveLength(256)
    expect(asQuery({ toString: () => 'evil' })).toBe('')
    expect(asQuery(undefined)).toBe('')
  })
})

describe('isFilesystemRoot', () => {
  it('recognises roots but not their children', () => {
    const root = path.parse(abs).root
    expect(isFilesystemRoot(root)).toBe(true)
    expect(isFilesystemRoot(abs)).toBe(false)
  })
})
