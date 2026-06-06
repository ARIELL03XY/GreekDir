import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { DIRECTORY_COLOR, getFileColor, getFileCategory } from '../utils/colors'
import { useI18n } from '../i18n'

interface DetailPanelProps {
  file: FileNode
  totalSize: number
  onClose: () => void
}

export default function DetailPanel({ file, totalSize, onClose }: DetailPanelProps) {
  const { t } = useI18n()
  const category = file.isDirectory ? 'directories' : getFileCategory(file.extension)
  const color = file.isDirectory ? DIRECTORY_COLOR : getFileColor(file.extension)

  return (
    <div className="w-80 border-l border-cream-300 bg-white p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-800">{t('detail.title')}</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-cream-200 flex items-center justify-center hover:bg-cream-300 transition-colors"
        >
          <svg className="w-4 h-4 text-sand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        {/* Color indicator */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl"
            style={{ backgroundColor: color }}
          />
          <div>
            <p className="font-medium text-gray-800 text-sm">{file.name}</p>
            <p className="text-xs text-sand-500">{t(`category.${category}`)}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-cream-200">
            <span className="text-sm text-sand-500">{t('detail.size')}</span>
            <span className="text-sm font-mono font-medium">{formatSize(file.size)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-cream-200">
            <span className="text-sm text-sand-500">{t('detail.percentage')}</span>
            <span className="text-sm font-mono font-medium">{getPercentage(file.size, totalSize)}</span>
          </div>
          {file.extension && (
            <div className="flex justify-between items-center py-2 border-b border-cream-200">
              <span className="text-sm text-sand-500">{t('detail.extension')}</span>
              <span className="text-sm font-mono">{file.extension}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-cream-200">
            <span className="text-sm text-sand-500">{t('detail.type')}</span>
            <span className="text-sm">{file.isDirectory ? t('file.directory') : t('file.file')}</span>
          </div>
        </div>

        {/* Path */}
        <div>
          <p className="text-xs text-sand-500 mb-1">{t('detail.fullPath')}</p>
          <p className="text-xs font-mono text-gray-600 bg-cream-100 rounded-lg p-3 break-all">
            {file.path}
          </p>
        </div>

        {/* Size bar */}
        <div>
          <p className="text-xs text-sand-500 mb-2">{t('detail.proportion')}</p>
          <div className="w-full bg-cream-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${Math.max(1, (file.size / totalSize) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>

        {/* Children count if directory */}
        {file.isDirectory && file.children && (
          <div className="flex justify-between items-center py-2 border-b border-cream-200">
            <span className="text-sm text-sand-500">{t('detail.items')}</span>
            <span className="text-sm font-mono font-medium">{file.children.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}
