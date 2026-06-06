const CATEGORY_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'images',
  '.jpeg': 'images',
  '.png': 'images',
  '.gif': 'images',
  '.svg': 'images',
  '.webp': 'images',
  '.bmp': 'images',
  '.ico': 'images',
  '.mp4': 'videos',
  '.avi': 'videos',
  '.mkv': 'videos',
  '.mov': 'videos',
  '.wmv': 'videos',
  '.flv': 'videos',
  '.webm': 'videos',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio',
  '.aac': 'audio',
  '.wma': 'audio',
  '.pdf': 'documents',
  '.doc': 'documents',
  '.docx': 'documents',
  '.xls': 'documents',
  '.xlsx': 'documents',
  '.ppt': 'documents',
  '.pptx': 'documents',
  '.txt': 'documents',
  '.md': 'documents',
  '.js': 'code',
  '.ts': 'code',
  '.tsx': 'code',
  '.jsx': 'code',
  '.py': 'code',
  '.java': 'code',
  '.cpp': 'code',
  '.c': 'code',
  '.rs': 'code',
  '.go': 'code',
  '.html': 'code',
  '.css': 'code',
  '.scss': 'code',
  '.zip': 'archives',
  '.rar': 'archives',
  '.7z': 'archives',
  '.tar': 'archives',
  '.gz': 'archives',
  '.exe': 'executables',
  '.dll': 'executables',
  '.msi': 'executables',
  '.app': 'executables',
  '.json': 'data',
  '.xml': 'data',
  '.csv': 'data',
  '.sql': 'data',
  '.db': 'data',
}

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

export function getFileCategory(extension?: string): string {
  if (!extension) return 'other'
  return CATEGORY_BY_EXTENSION[extension] || 'other'
}

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
