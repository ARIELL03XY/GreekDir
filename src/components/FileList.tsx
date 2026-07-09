import { FileNode } from '../types'
import { formatSize, getPercentage } from '../utils/format'
import { DIRECTORY_COLOR, getFileColor } from '../utils/colors'
import { useI18n } from '../i18n'

interface FileListProps {
  data: FileNode
  onSelect: (node: FileNode) => void
}

export default function FileList({ data, onSelect }: FileListProps) {
  const { t } = useI18n()
  const items = data.children || []

  return (
    <div className="h-full overflow-auto rounded-xl bg-white border border-cream-300">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-cream-100 border-b border-cream-300">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-sand-500">{t('file.name')}</th>
            <th className="text-right px-4 py-3 font-medium text-sand-500 w-28">{t('file.size')}</th>
            <th className="text-right px-4 py-3 font-medium text-sand-500 w-20">%</th>
            <th className="px-4 py-3 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={i}
              onClick={() => onSelect(item)}
              className="border-b border-cream-200 hover:bg-cream-100 cursor-pointer transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.isDirectory ? DIRECTORY_COLOR : getFileColor(item.extension) }}
                  />
                  <span className="truncate group-hover:text-accent transition-colors">
                    {item.isDirectory ? '📁 ' : ''}{item.name}
                  </span>
                  {item.inaccessible && (
                    <span className="text-xs text-amber-600 shrink-0" title={t('file.noAccess')}>
                      🔒 {t('file.noAccess')}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">
                {formatSize(item.size)}
              </td>
              <td className="px-4 py-3 text-right text-xs text-sand-500">
                {getPercentage(item.size, data.size)}
              </td>
              <td className="px-4 py-3">
                <div className="w-full bg-cream-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.max(1, (item.size / data.size) * 100)}%`,
                      backgroundColor: item.isDirectory ? DIRECTORY_COLOR : getFileColor(item.extension),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="p-8 text-center text-sand-400">
          {t('file.emptyFolder')}
        </div>
      )}
    </div>
  )
}
