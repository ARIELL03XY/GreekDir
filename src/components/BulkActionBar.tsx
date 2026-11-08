import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { TrashResult } from '../utils/trash'

interface BulkActionBarProps {
  count: number
  onTrash: () => Promise<void> | void
  onClear: () => void
  /** Outcome of the last bulk move, shown until it is dismissed or times out. */
  result?: TrashResult | null
  onDismissResult?: () => void
  /** When set, trashing is disabled and this explains why. */
  blockedReason?: string
}

type TrashState = 'idle' | 'confirm' | 'busy'

/**
 * Floating bar for the table views (FileList, TopFilesList, DuplicatesList, CleanupSuggestions):
 * shows the selection with a two-step confirm to trash it, and afterwards reports how many items
 * were really moved and how many were not.
 */
export default function BulkActionBar({
  count,
  onTrash,
  onClear,
  result,
  onDismissResult,
  blockedReason,
}: BulkActionBarProps) {
  const { t } = useI18n()
  const [state, setState] = useState<TrashState>('idle')

  // Changing the selection cancels a pending confirmation: it was for a different set of items.
  useEffect(() => {
    setState('idle')
  }, [count, blockedReason])

  if (count === 0 && !result) return null

  const handleTrash = async () => {
    if (blockedReason) return
    if (state === 'idle') {
      setState('confirm')
      return
    }
    if (state !== 'confirm') return
    setState('busy')
    try {
      await onTrash()
    } finally {
      setState('idle')
    }
  }

  const resultMessage = !result
    ? null
    : result.failed.length === 0
      ? t('bulk.resultOk', { moved: result.moved.length })
      : result.moved.length === 0
        ? t('bulk.resultFailed', { failed: result.failed.length })
        : t('bulk.resultPartial', { moved: result.moved.length, failed: result.failed.length })
  const resultIsProblem = !!result && result.failed.length > 0

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[92%]">
      {resultMessage && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-sm shadow-elevated ${
            resultIsProblem
              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
              : 'bg-surface text-ink-soft border-cream-300'
          }`}
        >
          <span>{resultMessage}</span>
          <button onClick={onDismissResult} className="text-sand-500 hover:text-ink-soft" aria-label={t('bulk.dismiss')}>
            ×
          </button>
        </div>
      )}
      {blockedReason && count > 0 && (
        <p
          role="alert"
          className="rounded-xl border px-4 py-2 text-sm shadow-elevated bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
        >
          {blockedReason}
        </p>
      )}
      {count > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-surface border border-cream-300 shadow-elevated px-4 py-2.5">
          <span className="text-sm text-ink-soft font-medium whitespace-nowrap">
            {t('bulk.selected', { count })}
          </span>
          <button
            onClick={handleTrash}
            disabled={state === 'busy' || !!blockedReason}
            className={`text-sm py-1.5 px-4 rounded-lg font-medium transition-all border active:scale-[0.98] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
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
      )}
    </div>
  )
}
