import { useState, useCallback } from 'react'
import { FileNode, ScanProgress } from './types'
import Header from './components/Header'
import WelcomeScreen from './components/WelcomeScreen'
import ScanningView from './components/ScanningView'
import ResultsView from './components/ResultsView'

type AppState = 'idle' | 'scanning' | 'results'

export default function App() {
  const [state, setState] = useState<AppState>('idle')
  const [scanData, setScanData] = useState<FileNode | null>(null)
  const [progress, setProgress] = useState<ScanProgress>({ scanned: 0, currentPath: '' })
  const [selectedPath, setSelectedPath] = useState<string>('')

  const handleSelectDirectory = useCallback(async () => {
    const dirPath = await window.electronAPI.selectDirectory()
    if (!dirPath) return

    setSelectedPath(dirPath)
    setState('scanning')
    setProgress({ scanned: 0, currentPath: '' })

    const unsubscribe = window.electronAPI.onScanProgress((p) => {
      setProgress(p)
    })

    const result = await window.electronAPI.scanDirectory(dirPath)
    unsubscribe()

    if (result) {
      setScanData(result)
      setState('results')
    } else {
      setState('idle')
    }
  }, [])

  const handleCancel = useCallback(async () => {
    await window.electronAPI.cancelScan()
    setState('idle')
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
          <WelcomeScreen onSelectDirectory={handleSelectDirectory} />
        )}
        {state === 'scanning' && (
          <ScanningView progress={progress} onCancel={handleCancel} />
        )}
        {state === 'results' && scanData && (
          <ResultsView data={scanData} />
        )}
      </main>
    </div>
  )
}
