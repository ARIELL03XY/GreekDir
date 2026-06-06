import DiskSelector from './DiskSelector'
import { useI18n } from '../i18n'

interface WelcomeScreenProps {
  onSelectDirectory: () => void
  onScanPath: (path: string) => void
}

export default function WelcomeScreen({ onSelectDirectory, onScanPath }: WelcomeScreenProps) {
  const { t } = useI18n()

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-2xl w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4v16M4 9h16M4 14h16" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">
          {t('welcome.title')}
        </h2>
        <p className="text-sand-500 mb-8 leading-relaxed">
          {t('welcome.description')}
        </p>

        {/* Disk selector */}
        <div className="text-left mb-10">
          <DiskSelector
            onSelectDisk={onScanPath}
            onSelectCustom={onSelectDirectory}
          />
        </div>

        <div className="grid grid-cols-3 gap-6 text-left">
          <div className="p-4 rounded-xl bg-white border border-cream-300">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm text-gray-700">{t('welcome.featureTreemap')}</h3>
            <p className="text-xs text-sand-500 mt-1">{t('welcome.featureTreemapDescription')}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-cream-300">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </div>
            <h3 className="font-medium text-sm text-gray-700">{t('welcome.featureList')}</h3>
            <p className="text-xs text-sand-500 mt-1">{t('welcome.featureListDescription')}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-cream-300">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm text-gray-700">{t('welcome.featureBrowse')}</h3>
            <p className="text-xs text-sand-500 mt-1">{t('welcome.featureBrowseDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
