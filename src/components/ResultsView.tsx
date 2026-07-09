import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileNode } from '../types'
import Treemap from './Treemap'
import FileList from './FileList'
import TopFilesList from './TopFilesList'
import DetailPanel from './DetailPanel'
import { formatSize } from '../utils/format'
import { getCategoryColor, TREEMAP_LEGEND_CATEGORIES } from '../utils/colors'
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
  const breadcrumbsRef = useRef<HTMLElement>(null)

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

  const legendItems = useMemo(() => TREEMAP_LEGEND_CATEGORIES.map((category) => ({
    category,
    color: getCategoryColor(category),
  })), [])

  // The node passed to child components always carries its effective children.
  const currentNodeForDisplay = withExpandedChildren(currentNode)

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-cream-300 flex items-center justify-between bg-white/50">
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
            <nav ref={breadcrumbsRef} className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto whitespace-nowrap">
              {breadcrumbs.map((node, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-sand-400">/</span>}
                  <button
                    onClick={() => handleBreadcrumb(i)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      i === breadcrumbs.length - 1
                        ? 'text-gray-800 font-medium bg-cream-200'
                        : 'text-sand-500 hover:text-gray-700 hover:bg-cream-200'
                    }`}
                  >
                    {getBreadcrumbLabel(node)}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-sm text-sand-500 whitespace-nowrap">
              {formatSize(currentNode.size)} {t('common.total')}
            </span>
            <div className="flex items-center bg-cream-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('treemap')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'treemap'
                    ? 'bg-white shadow-soft text-gray-800'
                    : 'text-sand-500 hover:text-gray-700'
                }`}
              >
                {t('results.treemap')}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-soft text-gray-800'
                    : 'text-sand-500 hover:text-gray-700'
                }`}
              >
                {t('results.list')}
              </button>
              <button
                onClick={() => setViewMode('topfiles')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'topfiles'
                    ? 'bg-white shadow-soft text-gray-800'
                    : 'text-sand-500 hover:text-gray-700'
                }`}
              >
                {t('results.topFiles')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {viewMode === 'treemap' ? (
            <div className="h-full flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cream-300 bg-white px-4 py-3 text-xs text-sand-500">
                <span className="font-medium text-gray-700">{t('results.legend')}</span>
                {legendItems.map(({ category, color }) => (
                  <span key={category} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span>{t(`category.${category}`)}</span>
                  </span>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                <Treemap
                  data={currentNodeForDisplay}
                  onSelect={handleDrillDown}
                  selectedFile={selectedFile}
                />
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <FileList
              data={currentNodeForDisplay}
              onSelect={handleDrillDown}
            />
          ) : (
            <TopFilesList
              totalSize={data.size}
              onSelect={setSelectedFile}
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
    </div>
  )
}
