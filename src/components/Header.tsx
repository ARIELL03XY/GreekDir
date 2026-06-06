import { useI18n } from '../i18n'

interface HeaderProps {
  state: 'idle' | 'scanning' | 'results'
  selectedPath: string
  onSelectDirectory: () => void
  onReset: () => void
}

export default function Header({ state, selectedPath, onSelectDirectory, onReset }: HeaderProps) {
  const { language, setLanguage, t } = useI18n()

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-cream-300 px-6 py-4 flex items-center justify-between drag-region">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16M4 9h16M4 14h16" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800">GreekDir</h1>
        </div>
        {selectedPath && (
          <span className="text-sm text-sand-500 font-mono truncate max-w-md">
            {selectedPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-sand-500">
          <span>{t('language.label')}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'es')}
            className="rounded-lg border border-cream-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none"
          >
            <option value="en">{t('language.english')}</option>
            <option value="es">{t('language.spanish')}</option>
          </select>
        </label>
        {state === 'results' && (
          <button onClick={onReset} className="btn-secondary text-sm py-2 px-4">
            {t('app.backToHome')}
          </button>
        )}
        <button onClick={onSelectDirectory} className="btn-primary text-sm py-2 px-4">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {t('app.selectFolder')}
          </span>
        </button>
      </div>
    </header>
  )
}
