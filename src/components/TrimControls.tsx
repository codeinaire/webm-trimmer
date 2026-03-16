import { useTrimStore } from '../store/trimStore'

export function TrimControls() {
  const { trimStart, trimEnd, duration, setTrimStart, setTrimEnd } = useTrimStore()

  const cutFromStart = trimStart
  const cutFromEnd = duration - trimEnd

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, which: 'start' | 'end') => {
    if (!e.shiftKey) return // plain arrow: browser default handles 0.1s step via step="0.1"
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

    e.preventDefault()
    const largeStep = 1.0
    const delta = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? largeStep : -largeStep

    if (which === 'start') {
      setTrimStart(trimStart + delta)
    } else {
      // For "cut from end", positive delta means cut MORE from end, so trimEnd decreases
      setTrimEnd(trimEnd - delta)
    }
  }

  return (
    <div className="trim-controls">
      <label className="trim-field">
        <span className="trim-label">Cut from start (s)</span>
        <input
          className="trim-input"
          type="number"
          min={0}
          max={parseFloat((trimEnd - 0.01).toFixed(2))}
          step={0.1}
          value={cutFromStart.toFixed(2)}
          onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => handleKeyDown(e, 'start')}
        />
      </label>
      <label className="trim-field">
        <span className="trim-label">Cut from end (s)</span>
        <input
          className="trim-input"
          type="number"
          min={0}
          max={parseFloat((duration - trimStart - 0.01).toFixed(2))}
          step={0.1}
          value={cutFromEnd.toFixed(2)}
          onChange={(e) => {
            const cutVal = parseFloat(e.target.value) || 0
            setTrimEnd(duration - cutVal)
          }}
          onKeyDown={(e) => handleKeyDown(e, 'end')}
        />
      </label>
      <p className="trim-hint">Arrow keys: ±0.1s &nbsp; Shift+Arrow: ±1.0s</p>
    </div>
  )
}
