import { useEffect, useState } from 'react'
import { DuplicateGroup, FileNode } from '../types'
import { formatSize } from '../utils/format'
import { getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'
import BulkActionBar from './BulkActionBar'

interface DuplicatesListProps {
  onSelect: (node: FileNode) => void
  onContextMenu?: (event: React.MouseEvent, node: FileNode) => void
}

/**
 * Groups of files with identical content, largest wasted space first.
 * Fetched on demand (not part of the initial scan) since hashing is
 * comparatively expensive; see find-duplicates in electron/main.ts.
 */
export default function DuplicatesList({ onSelect, onContextMenu }: DuplicatesListProps) {
  const { t } = useI18n()
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [hashed, setHashed] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.electronAPI.onDuplicatesProgress((progress) => {
      if (!cancelled) setHashed(progress.hashed)
    })
    window.electronAPI.findDuplicates().then((result) => {
      if (!cancelled) setGroups(result ?? [])
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const toggleSelected = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleBulkTrash = async () => {
    await Promise.all([...selected].map((path) => window.electronAPI.moveToTrash(path)))
    setSelected(new Set())
  }

  if (groups === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
        <p className="text-sm text-sand-500">{t('duplicates.scanning', { count: hashed })}</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sand-400">{t('duplicates.empty')}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-auto rounded-xl bg-surface border border-cream-300 divide-y divide-cream-200">
        {groups.map((group) => (
          <div key={group.hash}>
            <div className="px-4 py-2 bg-cream-100 text-xs font-medium text-sand-500">
              {t('duplicates.wasted', {
                size: formatSize(group.size),
                count: group.files.length,
                waste: formatSize(group.size * (group.files.length - 1)),
              })}
            </div>
            {group.files.map((file) => (
              <div
                key={file.path}
                onClick={() => onSelect(file)}
                onContextMenu={(event) => onContextMenu?.(event, file)}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-cream-200 last:border-b-0 hover:bg-cream-100 cursor-pointer transition-colors group"
              >
                <span onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(file.path)}
                    onChange={() => toggleSelected(file.path)}
                    className="accent-accent w-4 h-4"
                  />
                </span>
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getFileColor(file.extension) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm group-hover:text-accent transition-colors">{file.name}</p>
                  <p className="truncate text-xs text-sand-400 font-mono">{file.path}</p>
                </div>
                <span className="text-xs font-mono text-ink-mute shrink-0">{formatSize(file.size)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {selected.size > 0 && (
        <BulkActionBar count={selected.size} onTrash={handleBulkTrash} onClear={() => setSelected(new Set())} />
      )}
    </div>
  )
}
