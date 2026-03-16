import { useTrimStore } from '../store/trimStore'
import { trimAudio } from '../services/ffmpeg'
import { formatBytes } from '../utils/formatBytes'

export function TrimActions() {
  const file = useTrimStore((s) => s.file)
  const duration = useTrimStore((s) => s.duration)
  const trimStart = useTrimStore((s) => s.trimStart)
  const trimEnd = useTrimStore((s) => s.trimEnd)
  const isProcessing = useTrimStore((s) => s.isProcessing)
  const outputBlob = useTrimStore((s) => s.outputBlob)
  const setOutputBlob = useTrimStore((s) => s.setOutputBlob)
  const setIsProcessing = useTrimStore((s) => s.setIsProcessing)
  const setTrimProgress = useTrimStore((s) => s.setTrimProgress)
  const setStatus = useTrimStore((s) => s.setStatus)

  const isNoOp = trimStart === 0 && trimEnd === duration
  const estimatedBytes =
    file && duration > 0
      ? Math.round(((trimEnd - trimStart) / duration) * file.size)
      : null

  async function handleTrim() {
    if (!file || isProcessing || isNoOp) return

    setIsProcessing(true)
    setTrimProgress(0)

    try {
      const blob = await trimAudio(file, trimStart, trimEnd, (ratio) => {
        setTrimProgress(ratio)
      })
      setOutputBlob(blob)
    } catch (err) {
      console.error('Trim failed:', err)
      setStatus('error', 'Trim failed \u2014 please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDownload() {
    if (!outputBlob || !file) return
    const url = URL.createObjectURL(outputBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trimmed_${file.name}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <div className="trim-actions">
      {/* Estimated size — visible when file loaded, not no-op, not processing, no output yet */}
      {file && !isNoOp && !isProcessing && !outputBlob && estimatedBytes !== null && (
        <p className="size-estimate">Estimated: {formatBytes(estimatedBytes)}</p>
      )}

      {/* Trim button */}
      <button
        className="trim-button"
        disabled={isNoOp || isProcessing}
        onClick={handleTrim}
      >
        {isProcessing ? 'Trimming\u2026' : 'Trim'}
      </button>

      {/* Output panel — visible only after successful trim */}
      {outputBlob && file && (
        <div className="output-panel">
          <p className="size-comparison">
            Original: {formatBytes(file.size)} &rarr; Trimmed: {formatBytes(outputBlob.size)}
            {' '}({Math.round((1 - outputBlob.size / file.size) * 100)}% smaller)
          </p>
          <button className="download-button" onClick={handleDownload}>
            Download
          </button>
        </div>
      )}
    </div>
  )
}
