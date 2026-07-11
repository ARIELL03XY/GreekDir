import { useEffect, useState } from 'react'
import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { DIRECTORY_COLOR, getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'

interface SearchResultsProps {
  /** Search query (already debounced by the caller). */
  query: string
  /** Total size of the scanned root, for percentage display. */
  totalSize: number
  onSelect: (node: FileNode) => void
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
}

/** Whole-scan search results, largest first, served by the main process. */
export default function SearchResults({ query, totalSize, onSelect, onContextMenu }: SearchResultsProps) {
  const { t } = useI18n()
  const [results, setResults] = useState<FileNode[] | null>(null)

  useEffect(() => {
    let cancelled = false
    window.electronAPI.searchFiles(query, 200).then((matches) => {
      if (!cancelled) setResults(matches ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [query])

  if (results === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-xl bg-surface border border-cream-300">
      <div className="px-4 py-2 text-xs text-sand-500 border-b border-cream-200 sticky top-0 bg-cream-100">
        {t('search.results', { count: results.length.toLocaleString() })}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {results.map((node) => (
            <tr
              key={node.path}
              onClick={() => onSelect(node)}
              onContextMenu={(event) => onContextMenu?.(event, node)}
              className="border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: node.isDirectory ? DIRECTORY_COLOR : getFileColor(node.extension) }}
                  />
                  <div className="min-w-0">
                    <p className="truncate group-hover:text-accent transition-colors">
                      {node.isDirectory ? '📁 ' : ''}{node.name}
                    </p>
                    <p className="truncate text-xs text-sand-400 font-mono">{node.path}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-ink-mute w-28">
                {formatSize(node.size)}
              </td>
              <td className="px-4 py-3 text-right text-xs text-sand-500 w-20">
                {getPercentage(node.size, totalSize)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length === 0 && (
        <div className="p-8 text-center text-sand-400">{t('file.emptyFolder')}</div>
      )}
    </div>
  )
}
