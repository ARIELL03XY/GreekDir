import { useEffect, useState } from 'react'
import { CleanupSuggestion, FileNode } from '../types'
import { formatSize } from '../utils/format'
import { DIRECTORY_COLOR } from '../utils/colors'
import { useI18n } from '../i18n'
import { useTrashSelection } from '../hooks/useTrashSelection'
import BulkActionBar from './BulkActionBar'

interface CleanupSuggestionsProps {
  onSelect: (node: FileNode) => void
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
  /** Whether this scan included hidden/system folders — most junk patterns live behind that flag. */
  includeHidden: boolean
  /** Paths already moved to the trash during this session; they are hidden from the list. */
  trashedPaths: Set<string>
  /** Called with the paths that were really moved to the trash. */
  onTrashed: (paths: string[]) => void
}

/**
 * Known build-artifact/cache/dependency directories (node_modules, dist, .cache, …)
 * found within the current scan. See get-cleanup-suggestions in electron/main.ts.
 */
export default function CleanupSuggestions({
  onSelect,
  onContextMenu,
  includeHidden,
  trashedPaths,
  onTrashed,
}: CleanupSuggestionsProps) {
  const { t } = useI18n()
  const [found, setFound] = useState<CleanupSuggestion[] | null>(null)
  const { selected, toggle, replace, clear, result, dismissResult, trashSelected } = useTrashSelection(onTrashed)
  const items = found === null ? null : found.filter((item) => !trashedPaths.has(item.path))

  useEffect(() => {
    let cancelled = false
    window.electronAPI.getCleanupSuggestions().then((result) => {
      if (!cancelled) setFound(result ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const allSelected = (items?.length ?? 0) > 0 && items!.every((item) => selected.has(item.path))
  const toggleSelectAll = () => {
    if (allSelected) clear()
    else replace((items ?? []).map((item) => item.path))
  }

  const toNode = (item: CleanupSuggestion): FileNode => ({
    name: item.name,
    path: item.path,
    size: item.size,
    isDirectory: true,
  })

  if (items === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col gap-3">
      {!includeHidden && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-800 rounded-lg px-3 py-2 shrink-0">
          {t('cleanup.hint')}
        </p>
      )}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sand-400">{t('cleanup.empty')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-surface border border-cream-300">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cream-100 border-b border-cream-300">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="accent-accent w-4 h-4"
                    aria-label={t('bulk.selectAll')}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-sand-500">{t('file.name')}</th>
                <th className="text-left px-4 py-3 font-medium text-sand-500">{t('cleanup.pattern')}</th>
                <th className="text-right px-4 py-3 font-medium text-sand-500 w-28">{t('file.size')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.path}
                  onClick={() => onSelect(toNode(item))}
                  onContextMenu={(event) => onContextMenu?.(event, toNode(item))}
                  className="border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.path)}
                      onChange={() => toggle(item.path)}
                      className="accent-accent w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: DIRECTORY_COLOR }} />
                      <div className="min-w-0">
                        <p className="truncate group-hover:text-accent transition-colors">📁 {item.name}</p>
                        <p className="truncate text-xs text-sand-400 font-mono">{item.path}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-sand-500 font-mono">{item.pattern}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-mute">
                    {formatSize(item.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
