import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions.js'
import { useRef, useEffect } from 'react'
import { useTrimStore } from '../store/trimStore'

export function WaveformView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<Region | null>(null)
  const isSyncingFromStore = useRef(false)

  const audioBuffer = useTrimStore((s) => s.audioBuffer)
  const trimStart = useTrimStore((s) => s.trimStart)
  const trimEnd = useTrimStore((s) => s.trimEnd)
  const { setTrimStart, setTrimEnd } = useTrimStore()

  // Effect 1: Initialize wavesurfer + regions when audioBuffer changes
  useEffect(() => {
    if (!containerRef.current || !audioBuffer) return

    // Destroy previous instance before creating new one (prevents memory leak / visual corruption)
    wsRef.current?.destroy()
    regionRef.current = null

    // Extract channel data peaks from the AudioBuffer
    const channelData: Float32Array[] = []
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i))
    }

    const wsRegions = RegionsPlugin.create()

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#1a6fc4',
      height: 128,
      interact: true,
      plugins: [wsRegions],
    })

    // Load with pre-decoded peaks — no HTTP fetch, no CORS
    void wsRef.current.load('', channelData, audioBuffer.duration)

    wsRef.current.on('ready', () => {
      const region = wsRegions.addRegion({
        id: 'trim',
        start: trimStart,
        end: trimEnd,
        drag: false,
        resize: true,
        color: 'rgba(74, 158, 255, 0.15)',
      })
      regionRef.current = region

      // Region drag finished -> push to store
      wsRegions.on('region-updated', (r) => {
        if (isSyncingFromStore.current) return
        setTrimStart(r.start)
        setTrimEnd(r.end)
      })
    })

    return () => {
      wsRef.current?.destroy()
      wsRef.current = null
      regionRef.current = null
    }
  }, [audioBuffer]) // intentionally excludes trimStart/trimEnd — they are synced via effect 2

  // Effect 2: External store changes (e.g. numeric inputs) -> update region handle position
  useEffect(() => {
    if (!regionRef.current) return
    isSyncingFromStore.current = true
    regionRef.current.setOptions({ start: trimStart, end: trimEnd })
    isSyncingFromStore.current = false
  }, [trimStart, trimEnd])

  if (!audioBuffer) {
    return (
      <div className="waveform-placeholder">
        Load a .webm file to see the waveform
      </div>
    )
  }

  return <div ref={containerRef} className="waveform-container" />
}
