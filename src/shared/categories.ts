/** Extension → category mapping shared by the renderer (colors) and the main process (breakdown). */
export const CATEGORY_BY_EXTENSION: Record<string, string> = {
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

export function getFileCategory(extension?: string): string {
  if (!extension) return 'other'
  return CATEGORY_BY_EXTENSION[extension] || 'other'
}

/** Size in bytes per category for a subtree (files only). */
export interface CategoryBreakdown {
  category: string
  size: number
}
