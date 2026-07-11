import { useEffect, useState } from 'react'
import { CategoryBreakdown } from '../types'
import { formatSize } from '../utils/format'
import { getCategoryColor } from '../utils/colors'
import { useI18n } from '../i18n'

interface CategoryBarProps {
  /** Path of the directory whose subtree is summarized. */
  path: string
}

/**
 * Stacked bar showing how the current folder's bytes split across file
 * categories, with a per-category legend (only categories that are present).
 */
export default function CategoryBar({ path }: CategoryBarProps) {
  const { t } = useI18n()
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[] | null>(null)

  useEffect(() => {
    let cancelled = false
    window.electronAPI.getCategoryBreakdown(path).then((result) => {
      if (!cancelled) setBreakdown(result ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const total = (breakdown ?? []).reduce((acc, item) => acc + item.size, 0)
  if (!breakdown || total === 0) return null

  // Group slivers under 1% into the trailing "other" chip to keep it readable.
  const MIN_PERCENT = 1
  const major = breakdown.filter((item) => (item.size / total) * 100 >= MIN_PERCENT)
  const restSize = total - major.reduce((acc, item) => acc + item.size, 0)

  return (
    <div className="rounded-xl border border-cream-300 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sand-500 mb-2">
        <span className="font-medium text-ink-soft">{t('results.byCategory')}</span>
        {major.map(({ category, size }) => (
          <span key={category} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: getCategoryColor(category) }} />
            <span>
              {t(`category.${category}`)} · {formatSize(size)} ({((size / total) * 100).toFixed(1)}%)
            </span>
          </span>
        ))}
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream-200">
        {major.map(({ category, size }) => (
          <div
            key={category}
            title={`${t(`category.${category}`)} · ${formatSize(size)}`}
            style={{ width: `${(size / total) * 100}%`, backgroundColor: getCategoryColor(category) }}
          />
        ))}
        {restSize > 0 && (
          <div
            title={t('category.other')}
            style={{ width: `${(restSize / total) * 100}%`, backgroundColor: getCategoryColor('other') }}
          />
        )}
      </div>
    </div>
  )
}
