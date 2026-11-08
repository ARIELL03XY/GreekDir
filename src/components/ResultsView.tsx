import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileNode } from '../types'
import Treemap from './Treemap'
import FileList from './FileList'
import TopFilesList from './TopFilesList'
import DuplicatesList from './DuplicatesList'
import CleanupSuggestions from './CleanupSuggestions'
import DetailPanel from './DetailPanel'
import ContextMenu, { ContextMenuState } from './ContextMenu'
import CategoryBar from './CategoryBar'
import SearchResults from './SearchResults'
import { formatSize } from '../utils/format'
import { useI18n } from '../i18n'

/** True if any folder in the (shallow) scan tree could not be read. */
function hasInaccessible(node: FileNode): boolean {
  return !!node.inaccessible || !!node.children?.some(hasInaccessible)
}

/** Keys typed into a text field, list, checkbox or button belong to that control. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
}

interface ResultsViewProps {
  data: FileNode
  onBackHome: () => void
  onRescan: () => void
  /** Whether the current scan included hidden/system folders (affects cleanup suggestions). */
  includeHidden: boolean
}

type ViewMode = 'treemap' | 'list' | 'topfiles' | 'duplicates' | 'cleanup'

export default function ResultsView({ data, onBackHome, onRescan, includeHidden }: ResultsViewProps) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>('treemap')
  const [currentNode, setCurrentNode] = useState<FileNode>(data)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<FileNode[]>([data])
  /**
   * Stores lazily-loaded children keyed by directory path.
   * When a node arrives from the initial shallow scan without its children
   * (childCount is set), we fetch them via expand-directory and cache here.
   */
  const [expandedNodes, setExpandedNodes] = useState<Map<string, FileNode[]>>(new Map())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [filter, setFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [exportState, setExportState] = useState<'idle' | 'done'>('idle')
  /** Everything moved to the trash this session. Hidden from every view; sizes refresh on rescan. */
  const [trashedPaths, setTrashedPaths] = useState<Set<string>>(new Set())
  // macOS hides protected folders (Documents, Desktop, Mail…) until the app has Full Disk Access.
  const [fdaHintDismissed, setFdaHintDismissed] = useState(false)
  const showFdaHint = useMemo(
    () => window.electronAPI.platform === 'darwin' && !fdaHintDismissed && hasInaccessible(data),
    [data, fdaHintDismissed]
  )
  const breadcrumbsRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Debounce the search box so we don't walk the scan tree on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filter), 250)
    return () => clearTimeout(timer)
  }, [filter])

  // Global search kicks in from 2 characters; it covers the entire scan.
  const searchActive = debouncedFilter.trim().length >= 2

  const openContextMenu = useCallback(
    (event: { clientX: number; clientY: number; preventDefault: () => void }, node: FileNode) => {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY, node })
    },
    []
  )

  const handleExport = useCallback(async () => {
    const savedPath = await window.electronAPI.exportReport()
    if (savedPath) {
      setExportState('done')
      setTimeout(() => setExportState('idle'), 2500)
    }
  }, [])

  // Keep the deepest (current) crumb visible when the trail overflows.
  useEffect(() => {
    const nav = breadcrumbsRef.current
    if (nav) nav.scrollLeft = nav.scrollWidth
  }, [breadcrumbs])

  // Keyboard shortcuts: Ctrl/Cmd+F focuses search, Escape closes the detail panel
  // (the context menu handles its own Escape and takes priority while open).
  // On Windows/Linux the Clean Up shortcuts are handled here rather than by the native menu, so
  // Enter and Delete keep working in text fields; macOS registers them in the menu.
  useEffect(() => {
    const handlesCleanupKeys = window.electronAPI.platform !== 'darwin'
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (event.key === 'Escape' && !contextMenu && selectedFile) {
        setSelectedFile(null)
        return
      }
      if (!handlesCleanupKeys || contextMenu || !selectedFile || event.altKey || isTypingTarget(event.target)) return
      const api = window.electronAPI
      const key = event.key.toLowerCase()
      const action =
        !ctrl && event.key === 'Enter' ? () => api.openItem(selectedFile.path)
        : !ctrl && event.key === 'Delete' ? () => api.trashWithConfirmation(selectedFile.path)
        : ctrl && key === 'e' ? () => api.revealInFolder(selectedFile.path)
        : ctrl && key === 't' ? () => api.openTerminal(selectedFile.path)
        : ctrl && key === 'm' ? () => api.moveItem(selectedFile.path)
        : null
      if (!action) return
      event.preventDefault()
      void action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu, selectedFile])

  // The native Clean Up menu acts on the selected item: keep the main process informed.
  useEffect(() => {
    void window.electronAPI.setSelection(selectedFile?.path ?? null).catch(() => {})
  }, [selectedFile])
  useEffect(() => () => void window.electronAPI.setSelection(null).catch(() => {}), [])

  const getBreadcrumbLabel = useCallback((node: FileNode) => {
    if (node.name) return node.name
    if (node.path.length <= 36) return node.path
    return `…${node.path.slice(-35)}`
  }, [])

  /**
   * Returns the effective children for a node, preferring lazily-loaded data.
   */
  const getEffectiveChildren = useCallback(
    (node: FileNode): FileNode[] | undefined => {
      if (expandedNodes.has(node.path)) return expandedNodes.get(node.path)
      return node.children
    },
    [expandedNodes]
  )

  /**
   * Returns a display-ready copy of `node` with lazily-loaded children merged
   * in (if available). This keeps the original node object immutable.
   */
  const withExpandedChildren = useCallback(
    (node: FileNode): FileNode => {
      const effective = getEffectiveChildren(node)
      if (effective === node.children) return node
      return { ...node, children: effective }
    },
    [getEffectiveChildren]
  )

  const handleDrillDown = useCallback(async (node: FileNode) => {
    if (node.isDirectory) {
      const children = getEffectiveChildren(node)
      if (children && children.length > 0) {
        setCurrentNode(node)
        setBreadcrumbs((prev) => [...prev, node])
        setSelectedFile(null)
      } else {
        // Children are missing — either omitted from the initial shallow IPC
        // payload (childCount set) or stripped by the treemap's one-level
        // copies. Fetch them from the main-process cache.
        const fetched = await window.electronAPI.expandDirectory(node.path)
        if (fetched && fetched.length > 0) {
          setExpandedNodes((prev) => new Map(prev).set(node.path, fetched))
          setCurrentNode(node)
          setBreadcrumbs((prev) => [...prev, node])
          setSelectedFile(null)
        }
      }
    } else {
      setSelectedFile(node)
    }
  }, [getEffectiveChildren])

  const handleBreadcrumb = useCallback((index: number) => {
    const node = breadcrumbs[index]
    setCurrentNode(node)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))
    setSelectedFile(null)
  }, [breadcrumbs])

  const markTrashed = useCallback((paths: string[]) => {
    setTrashedPaths((prev) => new Set([...prev, ...paths]))
  }, [])

  // Items trashed or moved through the Clean Up menu, keyboard shortcuts or context menu.
  useEffect(() => {
    return window.electronAPI.onItemsRemoved((paths) => {
      markTrashed(paths)
      setSelectedFile((selected) => (selected && paths.includes(selected.path) ? null : selected))
    })
  }, [markTrashed])

  // The node passed to child components always carries its effective children, minus anything
  // already moved to the trash (and its size, so totals and percentages stay roughly right).
  const currentNodeForDisplay = useMemo(() => {
    const node = withExpandedChildren(currentNode)
    if (trashedPaths.size === 0 || !node.children) return node
    const kept = node.children.filter((child) => !trashedPaths.has(child.path))
    const removedSize = node.children.reduce((sum, child) => (trashedPaths.has(child.path) ? sum + child.size : sum), 0)
    return { ...node, children: kept, size: Math.max(0, node.size - removedSize) }
  }, [withExpandedChildren, currentNode, trashedPaths])

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-cream-300 flex flex-wrap items-center justify-between gap-y-2 bg-surface/50">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => handleBreadcrumb(0)}
              className="btn-secondary text-sm py-2 px-4 shrink-0"
            >
              {t('results.backToRoot')}
            </button>
            <button
              onClick={onBackHome}
              className="btn-secondary text-sm py-2 px-4 shrink-0"
            >
              {t('app.backToHome')}
            </button>
            <button
              onClick={onRescan}
              className="btn-secondary text-sm py-2 px-4 shrink-0"
            >
              {t('results.rescan')}
            </button>
            <button
              onClick={handleExport}
              className="btn-secondary text-sm py-2 px-4 shrink-0"
            >
              {exportState === 'done' ? t('results.exported') : t('results.export')}
            </button>
            <nav ref={breadcrumbsRef} className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto whitespace-nowrap">
              {breadcrumbs.map((node, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-sand-400">/</span>}
                  <button
                    onClick={() => handleBreadcrumb(i)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      i === breadcrumbs.length - 1
                        ? 'text-ink font-medium bg-cream-200'
                        : 'text-sand-500 hover:text-ink-soft hover:bg-cream-200'
                    }`}
                  >
                    {getBreadcrumbLabel(node)}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <input
              ref={searchInputRef}
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('results.searchPlaceholder')}
              className="w-44 rounded-lg border border-cream-300 bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-sand-400 outline-none focus:border-accent/50"
            />
            <span className="text-sm text-sand-500 whitespace-nowrap">
              {formatSize(currentNodeForDisplay.size)} {t('common.total')}
            </span>
            <div className="flex items-center bg-cream-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('treemap')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'treemap'
                    ? 'bg-surface shadow-soft text-ink'
                    : 'text-sand-500 hover:text-ink-soft'
                }`}
              >
                {t('results.treemap')}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-surface shadow-soft text-ink'
                    : 'text-sand-500 hover:text-ink-soft'
                }`}
              >
                {t('results.list')}
              </button>
              <button
                onClick={() => setViewMode('topfiles')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'topfiles'
                    ? 'bg-surface shadow-soft text-ink'
                    : 'text-sand-500 hover:text-ink-soft'
                }`}
              >
                {t('results.topFiles')}
              </button>
              <button
                onClick={() => setViewMode('duplicates')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'duplicates'
                    ? 'bg-surface shadow-soft text-ink'
                    : 'text-sand-500 hover:text-ink-soft'
                }`}
              >
                {t('results.duplicates')}
              </button>
              <button
                onClick={() => setViewMode('cleanup')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'cleanup'
                    ? 'bg-surface shadow-soft text-ink'
                    : 'text-sand-500 hover:text-ink-soft'
                }`}
              >
                {t('results.cleanup')}
              </button>
            </div>
          </div>
        </div>

        {showFdaHint && (
          <div role="status" className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <div className="min-w-0 flex-1">
              <p className="font-medium">🔒 {t('mac.fdaTitle')}</p>
              <p className="text-xs opacity-90">{t('mac.fdaBody')}</p>
            </div>
            <button onClick={() => void window.electronAPI.openPrivacySettings()} className="btn-secondary text-sm py-1.5 px-3 shrink-0">
              {t('mac.fdaOpen')}
            </button>
            <button onClick={() => setFdaHintDismissed(true)} className="text-xs underline shrink-0">
              {t('bulk.dismiss')}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden p-4">
          {searchActive ? (
            <SearchResults
              query={debouncedFilter}
              totalSize={data.size}
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
              trashedPaths={trashedPaths}
            />
          ) : viewMode === 'treemap' ? (
            <div className="h-full flex flex-col gap-3">
              <CategoryBar path={currentNode.path} refreshKey={trashedPaths.size} />
              <div className="min-h-0 flex-1">
                <Treemap
                  data={currentNodeForDisplay}
                  onSelect={handleDrillDown}
                  selectedFile={selectedFile}
                  onContextMenu={openContextMenu}
                />
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <FileList
              data={currentNodeForDisplay}
              onSelect={handleDrillDown}
              onContextMenu={openContextMenu}
              onTrashed={markTrashed}
            />
          ) : viewMode === 'topfiles' ? (
            <TopFilesList
              totalSize={data.size}
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
              trashedPaths={trashedPaths}
              onTrashed={markTrashed}
            />
          ) : viewMode === 'duplicates' ? (
            <DuplicatesList
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
              trashedPaths={trashedPaths}
              onTrashed={markTrashed}
            />
          ) : (
            <CleanupSuggestions
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
              includeHidden={includeHidden}
              trashedPaths={trashedPaths}
              onTrashed={markTrashed}
            />
          )}
        </div>
      </div>

      {selectedFile && (
        <DetailPanel
          file={selectedFile}
          totalSize={currentNode.size}
          onClose={() => setSelectedFile(null)}
          onTrashed={markTrashed}
        />
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onShowDetails={setSelectedFile}
          onClose={() => setContextMenu(null)}
          onTrashed={markTrashed}
        />
      )}
    </div>
  )
}
