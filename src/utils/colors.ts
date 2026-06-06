const FILE_COLORS: Record<string, string> = {
  // Images
  '.jpg': '#E8A87C',
  '.jpeg': '#E8A87C',
  '.png': '#E8A87C',
  '.gif': '#E8A87C',
  '.svg': '#E8A87C',
  '.webp': '#E8A87C',
  '.bmp': '#E8A87C',
  '.ico': '#E8A87C',
  
  // Videos
  '.mp4': '#C97B4A',
  '.avi': '#C97B4A',
  '.mkv': '#C97B4A',
  '.mov': '#C97B4A',
  '.wmv': '#C97B4A',
  '.flv': '#C97B4A',
  '.webm': '#C97B4A',
  
  // Audio
  '.mp3': '#85B8CB',
  '.wav': '#85B8CB',
  '.flac': '#85B8CB',
  '.ogg': '#85B8CB',
  '.aac': '#85B8CB',
  '.wma': '#85B8CB',
  
  // Documents
  '.pdf': '#D4837C',
  '.doc': '#7B9EC9',
  '.docx': '#7B9EC9',
  '.xls': '#7BAF7B',
  '.xlsx': '#7BAF7B',
  '.ppt': '#C9977B',
  '.pptx': '#C9977B',
  '.txt': '#B8B8B8',
  '.md': '#B8B8B8',
  
  // Code
  '.js': '#F0DB4F',
  '.ts': '#3178C6',
  '.tsx': '#3178C6',
  '.jsx': '#F0DB4F',
  '.py': '#4B8BBE',
  '.java': '#B07219',
  '.cpp': '#6295CB',
  '.c': '#555555',
  '.rs': '#DEA584',
  '.go': '#00ADD8',
  '.html': '#E34C26',
  '.css': '#563D7C',
  '.scss': '#CF649A',
  
  // Archives
  '.zip': '#8B5E3C',
  '.rar': '#8B5E3C',
  '.7z': '#8B5E3C',
  '.tar': '#8B5E3C',
  '.gz': '#8B5E3C',
  
  // Executables
  '.exe': '#9C5C5C',
  '.dll': '#9C7B5C',
  '.msi': '#9C5C5C',
  '.app': '#9C5C5C',
  
  // Data
  '.json': '#A6A6A6',
  '.xml': '#A6A6A6',
  '.csv': '#7BAF7B',
  '.sql': '#E38C00',
  '.db': '#E38C00',
}

const CATEGORY_COLORS: Record<string, string> = {
  images: '#E8A87C',
  videos: '#C97B4A',
  audio: '#85B8CB',
  documents: '#7B9EC9',
  code: '#3178C6',
  archives: '#8B5E3C',
  executables: '#9C5C5C',
  data: '#A6A6A6',
  other: '#D4CEC5',
}

export function getFileColor(extension?: string): string {
  if (!extension) return CATEGORY_COLORS.other
  return FILE_COLORS[extension] || CATEGORY_COLORS.other
}

export function getFileCategory(extension?: string): string {
  if (!extension) return 'other'
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico']
  const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
  const audioExts = ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.wma']
  const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md']
  const codeExts = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.rs', '.go', '.html', '.css', '.scss']
  const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz']
  const execExts = ['.exe', '.dll', '.msi', '.app']
  
  if (imageExts.includes(extension)) return 'images'
  if (videoExts.includes(extension)) return 'videos'
  if (audioExts.includes(extension)) return 'audio'
  if (docExts.includes(extension)) return 'documents'
  if (codeExts.includes(extension)) return 'code'
  if (archiveExts.includes(extension)) return 'archives'
  if (execExts.includes(extension)) return 'executables'
  return 'other'
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other
}

export { CATEGORY_COLORS }
