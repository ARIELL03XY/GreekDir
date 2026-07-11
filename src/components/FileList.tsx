import { useMemo, useState } from 'react'
import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { DIRECTORY_COLOR, getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'

interface FileListProps {
  data: FileNode
  onSelect: (node: FileNode) => void
  /** Case-insensitive name/extension filter. */
  filter?: string
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
}

type SortKey = 'name' | 'size'
type SortDir = 'asc' | 'desc'

export default function FileList({ data, onSelect, filter = '', onContextMenu }: FileListProps) {
  const { t } = useI18n()
  const [sortKey, setSortKey] = useState<SortKey>('size')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Sensible defaults: names A→Z, sizes big→small.
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const items = useMemo(() => {
    const query = filter.trim().toLowerCase()
    let result = data.children || []
    if (query) {
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.extension ?? '').toLowerCase().includes(query)
      )
    }
    const direction = sortDir === 'asc' ? 1 : -1
    return result.slice().sort((a, b) => {
      if (sortKey === 'name') return direction * a.name.localeCompare(b.name)
      return direction * (a.size - b.size)
    })
  }, [data.children, filter, sortKey, sortDir])

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div className="h-full overflow-auto rounded-xl bg-surface border border-cream-300">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-cream-100 border-b border-cream-300">
          <tr>
            <th
              onClick={() => toggleSort('name')}
              className="text-left px-4 py-3 font-medium text-sand-500 cursor-pointer select-none hover:text-ink-soft"
            >
              {t('file.name')}{sortArrow('name')}
            </th>
            <th
              onClick={() => toggleSort('size')}
              className="text-right px-4 py-3 font-medium text-sand-500 w-28 cursor-pointer select-none hover:text-ink-soft"
            >
              {t('file.size')}{sortArrow('size')}
            </th>
            <th className="text-right px-4 py-3 font-medium text-sand-500 w-20">%</th>
            <th className="px-4 py-3 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.path}
              onClick={() => onSelect(item)}
              onContextMenu={(event) => onContextMenu?.(event, item)}
              className="border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.isDirectory ? DIRECTORY_COLOR : getFileColor(item.extension) }}
                  />
                  <span className="truncate group-hover:text-accent transition-colors">
                    {item.isDirectory ? '📁 ' : ''}{item.name}
                  </span>
                  {item.inaccessible && (
                    <span className="text-xs text-amber-600 shrink-0" title={t('file.noAccess')}>
                      🔒 {t('file.noAccess')}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-ink-mute">
                {formatSize(item.size)}
              </td>
              <td className="px-4 py-3 text-right text-xs text-sand-500">
                {getPercentage(item.size, data.size)}
              </td>
              <td className="px-4 py-3">
                <div className="w-full bg-cream-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.max(1, (item.size / data.size) * 100)}%`,
                      backgroundColor: item.isDirectory ? DIRECTORY_COLOR : getFileColor(item.extension),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="p-8 text-center text-sand-400">
          {t('file.emptyFolder')}
        </div>
      )}
    </div>
  )
}
