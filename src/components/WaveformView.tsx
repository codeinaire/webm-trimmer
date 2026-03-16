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

    // Extract channel data peaks from the AudioBuffer
    const channelData: Float32Array[] = []
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i))
    }

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#1a6fc4',
      height: 128,
      interact: false,
      peaks: channelData,
      duration: audioBuffer.duration,
    })

    // Load with pre-decoded peaks — no HTTP fetch, no CORS
    void wsRef.current.load('', channelData, audioBuffer.duration)

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
