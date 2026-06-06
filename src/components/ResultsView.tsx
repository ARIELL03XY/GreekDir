import { useState } from 'react'
import { FileNode } from '../types'
import Treemap from './Treemap'
import FileList from './FileList'
import DetailPanel from './DetailPanel'
import { formatSize } from '../utils/format'

interface ResultsViewProps {
  data: FileNode
}

type ViewMode = 'treemap' | 'list'

export default function ResultsView({ data }: ResultsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('treemap')
  const [currentNode, setCurrentNode] = useState<FileNode>(data)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<FileNode[]>([data])

  const handleDrillDown = (node: FileNode) => {
    if (node.isDirectory && node.children && node.children.length > 0) {
      setCurrentNode(node)
      setBreadcrumbs((prev) => [...prev, node])
      setSelectedFile(null)
    } else {
      setSelectedFile(node)
    }
  }

  const handleBreadcrumb = (index: number) => {
    const node = breadcrumbs[index]
    setCurrentNode(node)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))
    setSelectedFile(null)
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-cream-300 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-2">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1 text-sm">
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
                    {node.name}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-sand-500">
              {formatSize(currentNode.size)} total
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
                Treemap
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-soft text-gray-800'
                    : 'text-sand-500 hover:text-gray-700'
                }`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden p-4">
          {viewMode === 'treemap' ? (
            <Treemap
              data={currentNode}
              onSelect={handleDrillDown}
              selectedFile={selectedFile}
            />
          ) : (
            <FileList
              data={currentNode}
              onSelect={handleDrillDown}
            />
          )}
        </div>
      </div>

      {/* Detail panel */}
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
