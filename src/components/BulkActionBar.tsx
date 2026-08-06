import { useState } from 'react'
import { useI18n } from '../i18n'

interface BulkActionBarProps {
  count: number
  onTrash: () => Promise<void> | void
  onClear: () => void
}

type TrashState = 'idle' | 'confirm' | 'busy'

/**
 * Floating bar shown when one or more rows are selected in a table view
 * (FileList, TopFilesList, DuplicatesList, CleanupSuggestions). Mirrors the
 * two-step confirm pattern used for single-file trash in DetailPanel/ContextMenu.
 */
export default function BulkActionBar({ count, onTrash, onClear }: BulkActionBarProps) {
  const { t } = useI18n()
  const [state, setState] = useState<TrashState>('idle')

  const handleTrash = async () => {
    if (state === 'idle') {
      setState('confirm')
      return
    }
    if (state !== 'confirm') return
    setState('busy')
    await onTrash()
    setState('idle')
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl bg-surface border border-cream-300 shadow-elevated px-4 py-2.5">
      <span className="text-sm text-ink-soft font-medium whitespace-nowrap">
        {t('bulk.selected', { count })}
      </span>
      <button
        onClick={handleTrash}
        disabled={state === 'busy'}
        className={`text-sm py-1.5 px-4 rounded-lg font-medium transition-all border active:scale-[0.98] whitespace-nowrap ${
          state === 'confirm'
            ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900'
        }`}
      >
        {state === 'busy' ? '…' : state === 'confirm' ? t('detail.trashConfirm') : t('bulk.trash')}
      </button>
      <button
        onClick={onClear}
        className="text-sm text-sand-500 hover:text-ink-soft transition-colors whitespace-nowrap"
      >
        {t('bulk.clear')}
      </button>
    </div>
  )
}
