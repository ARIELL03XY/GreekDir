import { useCallback, useEffect, useRef, useState } from 'react'
import { FileNode } from '../types'
import Treemap from './Treemap'
import FileList from './FileList'
import TopFilesList from './TopFilesList'
import DetailPanel from './DetailPanel'
import ContextMenu, { ContextMenuState } from './ContextMenu'
import CategoryBar from './CategoryBar'
import SearchResults from './SearchResults'
import { formatSize } from '../utils/format'
import { useI18n } from '../i18n'

interface ResultsViewProps {
  data: FileNode
  onBackHome: () => void
  onRescan: () => void
}

type ViewMode = 'treemap' | 'list' | 'topfiles'

export default function ResultsView({ data, onBackHome, onRescan }: ResultsViewProps) {
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
  const breadcrumbsRef = useRef<HTMLElement>(null)

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

  // The node passed to child components always carries its effective children.
  const currentNodeForDisplay = withExpandedChildren(currentNode)

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-cream-300 flex items-center justify-between bg-surface/50">
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
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('results.searchPlaceholder')}
              className="w-44 rounded-lg border border-cream-300 bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-sand-400 outline-none focus:border-accent/50"
            />
            <span className="text-sm text-sand-500 whitespace-nowrap">
              {formatSize(currentNode.size)} {t('common.total')}
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
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {searchActive ? (
            <SearchResults
              query={debouncedFilter}
              totalSize={data.size}
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
            />
          ) : viewMode === 'treemap' ? (
            <div className="h-full flex flex-col gap-3">
              <CategoryBar path={currentNode.path} />
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
            />
          ) : (
            <TopFilesList
              totalSize={data.size}
              onSelect={setSelectedFile}
              onContextMenu={openContextMenu}
            />
          )}
        </div>
      </div>

      {selectedFile && (
        <DetailPanel
          file={selectedFile}
          totalSize={currentNode.size}
          onClose={() => setSelectedFile(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onShowDetails={setSelectedFile}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
