import { useCallback, useEffect, useState } from 'react'
import { moveManyToTrash, type TrashResult } from '../utils/trash'

/**
 * Row selection plus "move the selection to the trash" for the table views.
 * Items that could not be moved stay selected so the user can see and retry them;
 * the ones that were moved are reported through `onTrashed`.
 */
export function useTrashSelection(onTrashed: (movedPaths: string[]) => void) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<TrashResult | null>(null)

  // The result message is transient.
  useEffect(() => {
    if (!result) return
    const timer = setTimeout(() => setResult(null), 8000)
    return () => clearTimeout(timer)
  }, [result])

  const toggle = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const replace = useCallback((paths: string[]) => setSelected(new Set(paths)), [])
  const clear = useCallback(() => setSelected(new Set()), [])
  const dismissResult = useCallback(() => setResult(null), [])

  const trashSelected = useCallback(async () => {
    const outcome = await moveManyToTrash([...selected])
    setResult(outcome)
    setSelected(new Set(outcome.failed))
    if (outcome.moved.length > 0) onTrashed(outcome.moved)
  }, [selected, onTrashed])

  return { selected, toggle, replace, clear, result, dismissResult, trashSelected }
}
