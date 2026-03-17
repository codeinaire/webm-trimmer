import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

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

  const mountDir = '/workerfs'
  const inputPath = `${mountDir}/${file.name}`
  const outputName = `output_${Date.now()}.webm`

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => { onProgress(progress) }
    : null

  if (progressHandler) {
    ffmpeg.on('progress', progressHandler)
  }

  try {
    // Mount input via WORKERFS to avoid copying large files into WASM memory
    await ffmpeg.createDir(mountDir)
    await ffmpeg.mount('WORKERFS', { files: [file] }, mountDir)

    await ffmpeg.exec([
      '-ss', String(trimStart),
      '-to', String(trimEnd),
      '-i', inputPath,
      '-c', 'copy',
      '-f', 'webm',
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName) as Uint8Array
    return new Blob([data.buffer as ArrayBuffer], { type: 'audio/webm' })
  } finally {
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler)
    }
    ffmpeg.unmount(mountDir).catch(() => {})
    ffmpeg.deleteDir(mountDir).catch(() => {})
    ffmpeg.deleteFile(outputName).catch(() => {})
  }
}

export { ffmpeg }
