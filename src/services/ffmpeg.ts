import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

let loadPromise: Promise<void> | null = null

export async function ensureLoaded(): Promise<void> {
  if (ffmpeg.loaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'

    ffmpeg.on('log', ({ message }) => {
      console.log('[ffmpeg]', message)
    })

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
  })()

  return loadPromise
}

export { ffmpeg, fetchFile }
