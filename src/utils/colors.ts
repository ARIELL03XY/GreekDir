import { getFileCategory } from '../shared/categories'

export { getFileCategory }

const CATEGORY_COLORS: Record<string, string> = {
  directories: '#334155',
  images: '#E11D48',
  videos: '#7C3AED',
  audio: '#0891B2',
  documents: '#2563EB',
  code: '#F59E0B',
  archives: '#A16207',
  executables: '#DC2626',
  data: '#059669',
  other: '#64748B',
}

export const TREEMAP_LEGEND_CATEGORIES = [
  'directories',
  'images',
  'videos',
  'audio',
  'documents',
  'code',
  'archives',
  'executables',
  'data',
  'other',
] as const

export const DIRECTORY_COLOR = CATEGORY_COLORS.directories

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other
}

export function getFileColor(extension?: string): string {
  return getCategoryColor(getFileCategory(extension))
}

export function getTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '')
  const normalized = hex.length === 3
    ? hex.split('').map((value) => value + value).join('')
    : hex

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.62 ? '#0F172A' : '#FFFFFF'
}
