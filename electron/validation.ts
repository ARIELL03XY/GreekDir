/**
 * Argument validation for IPC handlers. Everything the renderer sends is treated as
 * untrusted input: these helpers turn `unknown` into a safe value or throw.
 */
import path from 'path'

const MAX_PATH_LENGTH = 32767

/** An absolute path string without NUL bytes. Throws otherwise. */
export function asPath(value: unknown, what = 'path'): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    value.includes('\0') ||
    !path.isAbsolute(value)
  ) {
    throw new Error(`Invalid ${what}`)
  }
  return value
}

/** Like asPath but returns null instead of throwing. */
export function asPathOrNull(value: unknown): string | null {
  try {
    return asPath(value)
  } catch {
    return null
  }
}

/** An integer clamped to [min, max]; `fallback` when the value is not a finite number. */
export function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(max, Math.max(min, n))
}

/** A bounded list of non-empty, bounded strings; anything else is dropped. */
export function asStringList(value: unknown, maxItems = 200, maxLength = 255): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= maxLength)
    .slice(0, maxItems)
}

/** A search query: a string, truncated. Anything else becomes the empty string. */
export function asQuery(value: unknown, maxLength = 256): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

/** True for a filesystem root such as `C:\` or `/`. */
export function isFilesystemRoot(p: string): boolean {
  return path.parse(p).root === p
}
