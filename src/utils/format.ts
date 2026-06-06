export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatNumber(num: number): string {
  return num.toLocaleString()
}

export function getPercentage(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}
