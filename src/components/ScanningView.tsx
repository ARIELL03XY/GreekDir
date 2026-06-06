import { ScanProgress } from '../types'
import { formatNumber } from '../utils/format'

interface ScanningViewProps {
  progress: ScanProgress
  onCancel: () => void
}

export default function ScanningView({ progress, onCancel }: ScanningViewProps) {
  const shortPath = progress.currentPath.length > 60
    ? '...' + progress.currentPath.slice(-57)
    : progress.currentPath

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="relative w-16 h-16 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-cream-300" />
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Analizando...
        </h2>
        <p className="text-sand-500 mb-2">
          {formatNumber(progress.scanned)} archivos escaneados
        </p>
        <p className="text-xs text-sand-400 font-mono truncate mb-8 h-4">
          {shortPath}
        </p>
        <button onClick={onCancel} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}
