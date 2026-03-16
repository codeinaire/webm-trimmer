import { useState } from 'react'
import { ensureLoaded, ffmpeg } from './services/ffmpeg'
import './App.css'

function App() {
  const [status, setStatus] = useState<string>('Not loaded')
  const [loading, setLoading] = useState(false)

  async function handleLoadAndTest() {
    setLoading(true)
    setStatus('Loading ffmpeg.wasm...')
    try {
      await ensureLoaded()
      setStatus('WASM loaded. Running -version...')
      const exitCode = await ffmpeg.exec(['-version'])
      setStatus(`SUCCESS: ffmpeg.exec(['-version']) exited with code ${exitCode}`)
    } catch (err) {
      setStatus(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>WebP Trimmer — Phase 1 Smoke Test</h1>
      <button onClick={handleLoadAndTest} disabled={loading}>
        {loading ? 'Loading...' : 'Load ffmpeg.wasm and Run Smoke Test'}
      </button>
      <pre style={{ marginTop: '1rem', padding: '1rem', background: '#f0f0f0' }}>
        {status}
      </pre>
    </div>
  )
}

export default App
