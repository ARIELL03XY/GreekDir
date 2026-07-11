import { useI18n } from '../i18n'
import { useTheme } from '../theme'

interface HeaderProps {
  state: 'idle' | 'scanning' | 'results'
  selectedPath: string
  onSelectDirectory: () => void
  onReset: () => void
}

export default function Header({ state, selectedPath, onSelectDirectory, onReset }: HeaderProps) {
  const { language, setLanguage, t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  // With the hiddenInset title bar on macOS the traffic lights overlay the
  // top-left corner, so shift the header content right to clear them.
  const isMac = window.electronAPI?.platform === 'darwin'

  return (
    <header className={`bg-surface/80 backdrop-blur-sm border-b border-cream-300 py-4 pr-6 flex items-center justify-between drag-region ${isMac ? 'pl-20' : 'pl-6'}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16M4 9h16M4 14h16" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-ink">GreekDir</h1>
        </div>
        {selectedPath && (
          <span className="text-sm text-sand-500 font-mono truncate max-w-md">
            {selectedPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          title={t(theme === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark')}
          className="w-8 h-8 rounded-lg border border-cream-300 bg-surface flex items-center justify-center text-sand-500 hover:text-ink-soft hover:bg-cream-200 transition-colors"
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <label className="flex items-center gap-2 text-sm text-sand-500">
          <span>{t('language.label')}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'es')}
            className="rounded-lg border border-cream-300 bg-surface px-2 py-1 text-sm text-ink-soft outline-none"
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
