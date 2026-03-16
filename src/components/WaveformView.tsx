import WaveSurfer from 'wavesurfer.js'
import { useRef, useEffect } from 'react'
import { useTrimStore } from '../store/trimStore'

export function WaveformView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const audioBuffer = useTrimStore((state) => state.audioBuffer)

  useEffect(() => {
    if (!containerRef.current || !audioBuffer) return

    // Destroy previous instance before creating new one (prevents memory leak / visual corruption)
    wsRef.current?.destroy()

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#1a6fc4',
      height: 128,
      interact: false,
    })

    wsRef.current.loadDecodedBuffer(audioBuffer)

    return () => {
      wsRef.current?.destroy()
      wsRef.current = null
    }
  }, [audioBuffer])

  if (!audioBuffer) {
    return (
      <div className="waveform-placeholder">
        Load a .webm file to see the waveform
      </div>
    )
  }

  return <div ref={containerRef} className="waveform-container" />
}
