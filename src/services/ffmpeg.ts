import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

let loadPromise: Promise<void> | null = null

export async function ensureLoaded(): Promise<void> {
  if (ffmpeg.loaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    ffmpeg.on('log', ({ message }) => {
      console.log('[ffmpeg]', message)
    })

    // Fetch from local public/ and convert to blob URLs
    // toBlobURL is required — ffmpeg.wasm uses dynamic import() internally
    // which needs blob: URLs to work under COEP: require-corp
    const coreURL = await toBlobURL('/ffmpeg-core.js', 'text/javascript')
    const wasmURL = await toBlobURL('/ffmpeg-core.wasm', 'application/wasm')

    await ffmpeg.load({ coreURL, wasmURL })
  })().catch((err) => {
    loadPromise = null  // Reset so next call retries
    throw err
  })

  return loadPromise
}

export async function trimAudio(
  file: File,
  trimStart: number,
  trimEnd: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  await ensureLoaded()

  const inputName = `input_${Date.now()}.webm`
  const outputName = `output_${Date.now()}.webm`

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => { onProgress(progress) }
    : null

  if (progressHandler) {
    ffmpeg.on('progress', progressHandler)
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    await ffmpeg.exec([
      '-ss', String(trimStart),
      '-to', String(trimEnd),
      '-i', inputName,
      '-c:a', 'libopus',
      '-f', 'webm',
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName) as Uint8Array
    return new Blob([data.buffer as ArrayBuffer], { type: 'audio/webm' })
  } finally {
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler)
    }
    ffmpeg.deleteFile(inputName).catch(() => {})
    ffmpeg.deleteFile(outputName).catch(() => {})
  }
}

export { ffmpeg, fetchFile }
