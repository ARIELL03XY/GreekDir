import { useEffect, useState } from 'react'
import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'
import { useTrashSelection } from '../hooks/useTrashSelection'
import BulkActionBar from './BulkActionBar'

interface TopFilesListProps {
  /** Total size of the scanned root, for percentage display. */
  totalSize: number
  onSelect: (node: FileNode) => void
  /** Case-insensitive name/extension/path filter. */
  filter?: string
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
  /** Paths already moved to the trash during this session; they are hidden from the list. */
  trashedPaths: Set<string>
  /** Called with the paths that were really moved to the trash. */
  onTrashed: (paths: string[]) => void
}

/**
 * Shows the largest files of the entire scan (not just the current folder),
 * fetched from the main-process cache.
 */
export default function TopFilesList({
  totalSize,
  onSelect,
  filter = '',
  onContextMenu,
  trashedPaths,
  onTrashed,
}: TopFilesListProps) {
  const { t } = useI18n()
  const [files, setFiles] = useState<FileNode[] | null>(null)
  const { selected, toggle, replace, clear, result, dismissResult, trashSelected } = useTrashSelection(onTrashed)
  const query = filter.trim().toLowerCase()
  const visibleFiles = (files ?? []).filter(
    (file) =>
      !trashedPaths.has(file.path) &&
      (!query || file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query))
  )

  useEffect(() => {
    let cancelled = false
    window.electronAPI.getTopFiles(100).then((result) => {
      if (!cancelled) setFiles(result ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => selected.has(file.path))
  const toggleSelectAll = () => {
    if (allVisibleSelected) clear()
    else replace(visibleFiles.map((file) => file.path))
  }

  if (files === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-auto rounded-xl bg-surface border border-cream-300">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-cream-100 border-b border-cream-300">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="accent-accent w-4 h-4"
                  aria-label={t('bulk.selectAll')}
                />
              </th>
              <th className="text-right px-4 py-3 font-medium text-sand-500 w-12">#</th>
              <th className="text-left px-4 py-3 font-medium text-sand-500">{t('file.name')}</th>
              <th className="text-right px-4 py-3 font-medium text-sand-500 w-28">{t('file.size')}</th>
              <th className="text-right px-4 py-3 font-medium text-sand-500 w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {visibleFiles.map((file, i) => (
              <tr
                key={file.path}
                onClick={() => onSelect(file)}
                onContextMenu={(event) => onContextMenu?.(event, file)}
                className="border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(file.path)}
                    onChange={() => toggle(file.path)}
                    className="accent-accent w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3 text-right text-xs text-sand-400 font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: getFileColor(file.extension) }}
                    />
                    <div className="min-w-0">
                      <p className="truncate group-hover:text-accent transition-colors">{file.name}</p>
                      <p className="truncate text-xs text-sand-400 font-mono">{file.path}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-ink-mute">
                  {formatSize(file.size)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-sand-500">
                  {getPercentage(file.size, totalSize)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleFiles.length === 0 && (
          <div className="p-8 text-center text-sand-400">{t('file.emptyFolder')}</div>
        )}
      </div>
      <BulkActionBar
        count={selected.size}
        onTrash={trashSelected}
        onClear={clear}
        result={result}
        onDismissResult={dismissResult}
      />
    </div>
  )
}
