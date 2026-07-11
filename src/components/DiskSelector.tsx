import { useEffect, useState } from 'react'
import { DiskInfo } from '../types'
import { formatSize } from '../utils/format'
import { useI18n } from '../i18n'

interface DiskSelectorProps {
  onSelectDisk: (diskPath: string) => void
  onSelectCustom: () => void
}

export default function DiskSelector({ onSelectDisk, onSelectCustom }: DiskSelectorProps) {
  const { t } = useI18n()
  const [drives, setDrives] = useState<DiskInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getDrives().then((disks) => {
      setDrives(disks)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 rounded-full border-2 border-cream-300 border-t-accent animate-spin" />
        <span className="ml-3 text-sm text-sand-500">{t('common.loadingDisks')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {drives.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-sand-500 uppercase tracking-wide">
            {t('disk.available')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {drives.map((disk, i) => {
              const usedPercent = disk.totalSize > 0
                ? (disk.usedSpace / disk.totalSize) * 100
                : 0
              const barColor = usedPercent > 90 ? '#D4837C' : usedPercent > 70 ? '#E8A87C' : '#7BAF7B'

              return (
                <button
                  key={i}
                  onClick={() => onSelectDisk(disk.path)}
                  className="p-4 rounded-xl bg-surface border border-cream-300 hover:border-accent/40 hover:shadow-medium transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate group-hover:text-accent transition-colors">
                        {disk.name}
                      </p>
                      <p className="text-xs text-sand-400 font-mono truncate">
                        {disk.path}
                        {disk.filesystem ? ` · ${disk.filesystem}` : ''}
                      </p>
                    </div>
                  </div>

                  {disk.totalSize > 0 && (
                    <>
                      <div className="w-full bg-cream-200 rounded-full h-2 mb-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${usedPercent}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-sand-500">
                        <span>{t('disk.used', { used: formatSize(disk.usedSpace) })}</span>
                        <span>{t('disk.freeOfTotal', { free: formatSize(disk.freeSpace), total: formatSize(disk.totalSize) })}</span>
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="pt-2">
        <button onClick={onSelectCustom} className="btn-secondary text-sm w-full">
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {t('disk.selectOther')}
          </span>
        </button>
      </div>
    </div>
  )
}
