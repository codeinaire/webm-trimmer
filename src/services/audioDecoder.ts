let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export async function decodeForWaveform(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  // slice(0) creates a copy — original remains readable for ffmpeg VFS write in Phase 4
  return ctx.decodeAudioData(arrayBuffer.slice(0))
}
