import { useEffect, useState } from 'react'
import { FileNode } from '../types'
import { useI18n } from '../i18n'

export interface ContextMenuState {
  x: number
  y: number
  node: FileNode
}

interface ContextMenuProps {
  menu: ContextMenuState
  onShowDetails: (node: FileNode) => void
  onClose: () => void
}

/**
 * Right-click menu with quick file actions. Rendered inside a full-screen
 * overlay that closes it on any outside click or Escape.
 */
export default function ContextMenu({ menu, onShowDetails, onClose }: ContextMenuProps) {
  const { t } = useI18n()
  const [confirmingTrash, setConfirmingTrash] = useState(false)

  useEffect(() => {
    setConfirmingTrash(false)
  }, [menu])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleTrash = async () => {
    if (!confirmingTrash) {
      setConfirmingTrash(true)
      return
    }
    await window.electronAPI.moveToTrash(menu.node.path)
    onClose()
  }

  // Keep the menu inside the viewport when opened near the edges.
  const style = {
    left: Math.min(menu.x, window.innerWidth - 230),
    top: Math.min(menu.y, window.innerHeight - 140),
  }

  const itemClass =
    'w-full text-left px-4 py-2 text-sm text-ink-soft hover:bg-cream-200 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        className="absolute w-56 py-1.5 rounded-xl bg-surface border border-cream-300 shadow-elevated"
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-4 py-1.5 text-xs text-sand-500 truncate border-b border-cream-200 mb-1">
          {menu.node.name}
        </p>
        <button className={itemClass} onClick={() => { onShowDetails(menu.node); onClose() }}>
          {t('detail.title')}
        </button>
        <button className={itemClass} onClick={() => { window.electronAPI.revealInFolder(menu.node.path); onClose() }}>
          {t('detail.reveal')}
        </button>
        <button
          className={`${itemClass} ${confirmingTrash ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}
          onClick={handleTrash}
        >
          {confirmingTrash ? t('detail.trashConfirm') : t('detail.trash')}
        </button>
      </div>
    </div>
  )
}
