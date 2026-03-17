import { useTrimStore } from '../store/trimStore'
import { checkFileFormat, MAX_FILE_SIZE } from '../utils/formatValidation'
import { decodeForWaveform } from '../services/audioDecoder'

async function loadAudioFile(file: File): Promise<void> {
  const { setStatus, setFile, setAudioBuffer } = useTrimStore.getState()

  // 1. Validate format via magic bytes
  const check = await checkFileFormat(file)
  if (!check.valid) {
    setStatus('error', check.reason)
    return
  }

  // 2. Guard on file size
  if (file.size > MAX_FILE_SIZE) {
    setStatus('error', 'File is too large (max 130 MB). Select a shorter recording.')
    return
  }

  // 3. Update store — triggers 'decoding' status
  setFile(file)

  // 4. Read bytes and decode
  try {
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await decodeForWaveform(arrayBuffer)
    setAudioBuffer(audioBuffer)
  } catch (err) {
    setStatus('error', `Could not decode audio: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function FileLoader() {
  const status = useTrimStore((state) => state.status)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      loadAudioFile(file)
    }
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="file-loader">
      <label className="file-loader-button">
        <input
          type="file"
          accept=".webm,audio/webm,video/webm"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        {status === 'decoding' ? 'Decoding...' : 'Open file'}
      </label>
    </div>
  )
}
