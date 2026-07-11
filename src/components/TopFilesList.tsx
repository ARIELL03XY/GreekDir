import { useEffect, useState } from 'react'
import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'

interface TopFilesListProps {
  /** Total size of the scanned root, for percentage display. */
  totalSize: number
  onSelect: (node: FileNode) => void
  /** Case-insensitive name/extension/path filter. */
  filter?: string
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
}

/**
 * Shows the largest files of the entire scan (not just the current folder),
 * fetched from the main-process cache.
 */
export default function TopFilesList({ totalSize, onSelect, filter = '', onContextMenu }: TopFilesListProps) {
  const { t } = useI18n()
  const [files, setFiles] = useState<FileNode[] | null>(null)
  const query = filter.trim().toLowerCase()
  const visibleFiles = (files ?? []).filter(
    (file) => !query || file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
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

  if (files === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-xl bg-surface border border-cream-300">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-cream-100 border-b border-cream-300">
          <tr>
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
  )
}
