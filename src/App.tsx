import { useState, useCallback, useEffect } from 'react'
import { FileNode, ScanProgress } from './types'
import Header from './components/Header'
import WelcomeScreen from './components/WelcomeScreen'
import ScanningView from './components/ScanningView'
import ResultsView from './components/ResultsView'

type AppState = 'idle' | 'scanning' | 'results'

const EXCLUDE_PATTERNS_STORAGE_KEY = 'greekdir-exclude-patterns'

function getInitialExcludePatterns(): string[] {
  try {
    const stored = localStorage.getItem(EXCLUDE_PATTERNS_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

export default function App() {
  const [state, setState] = useState<AppState>('idle')
  const [scanData, setScanData] = useState<FileNode | null>(null)
  const [progress, setProgress] = useState<ScanProgress>({ scanned: 0, currentPath: '' })
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [excludePatterns, setExcludePatterns] = useState<string[]>(getInitialExcludePatterns)

  useEffect(() => {
    localStorage.setItem(EXCLUDE_PATTERNS_STORAGE_KEY, JSON.stringify(excludePatterns))
  }, [excludePatterns])

  const startScan = useCallback(async (dirPath: string) => {
    setSelectedPath(dirPath)
    setState('scanning')
    setProgress({ scanned: 0, currentPath: '' })

    const unsubscribe = window.electronAPI.onScanProgress((p) => {
      setProgress(p)
    })

    try {
      const result = await window.electronAPI.scanDirectory(dirPath, includeHidden, excludePatterns)
      if (result) {
        setScanData(result)
        setState('results')
      } else {
        setState('idle')
      }
    } catch (err) {
      // A failed scan (e.g. permission errors) should not leave the UI stuck.
      console.error('Scan failed:', err)
      setState('idle')
    } finally {
      unsubscribe()
    }
  }, [includeHidden])

  const handleSelectDirectory = useCallback(async () => {
    const dirPath = await window.electronAPI.selectDirectory()
    if (!dirPath) return
    startScan(dirPath)
  }, [startScan])

  const handleScanPath = useCallback((path: string) => {
    startScan(path)
  }, [startScan])

  const handleCancel = useCallback(async () => {
    await window.electronAPI.cancelScan()
    setState('idle')
    setSelectedPath('')
    setProgress({ scanned: 0, currentPath: '' })
  }, [])

  const handleReset = useCallback(() => {
    setState('idle')
    setScanData(null)
    setSelectedPath('')
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        state={state}
        selectedPath={selectedPath}
        onSelectDirectory={handleSelectDirectory}
        onReset={handleReset}
      />
      <main className="flex-1 overflow-hidden">
        {state === 'idle' && (
          <WelcomeScreen
            onSelectDirectory={handleSelectDirectory}
            onScanPath={handleScanPath}
            includeHidden={includeHidden}
            onIncludeHiddenChange={setIncludeHidden}
            excludePatterns={excludePatterns}
            onExcludePatternsChange={setExcludePatterns}
          />
        )}
        {state === 'scanning' && (
          <ScanningView progress={progress} onCancel={handleCancel} />
        )}
        {state === 'results' && scanData && (
          <ResultsView
            data={scanData}
            onBackHome={handleReset}
            includeHidden={includeHidden}
            onRescan={() => startScan(selectedPath)}
          />
        )}
      </main>
    </div>
  )
}
