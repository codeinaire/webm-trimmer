import { useTrimStore } from './store/trimStore'
import { FileLoader } from './components/FileLoader'
import { WaveformView } from './components/WaveformView'
import './App.css'

function App() {
  const status = useTrimStore((state) => state.status)
  const errorMessage = useTrimStore((state) => state.errorMessage)
  const file = useTrimStore((state) => state.file)
  const duration = useTrimStore((state) => state.duration)

  return (
    <div className="app-container">
      <h1 className="app-title">WebP Trimmer</h1>

      <FileLoader />

      {status === 'error' && errorMessage && (
        <div className="error-box">{errorMessage}</div>
      )}

      {status === 'decoding' && (
        <p className="decoding-text">Decoding audio...</p>
      )}

      {status === 'ready' && file && (
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-duration">{duration.toFixed(1)}s</span>
        </div>
      )}

      <WaveformView />
    </div>
  )
}

export default App
