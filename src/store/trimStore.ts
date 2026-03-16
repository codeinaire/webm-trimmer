import { create } from 'zustand'

type AppStatus = 'idle' | 'decoding' | 'ready' | 'error'

interface TrimStore {
  // Phase 2 fields
  file: File | null
  audioBuffer: AudioBuffer | null
  duration: number
  status: AppStatus
  errorMessage: string | null

  // Phase 3 stubs (set to initial values, populated in Phase 3)
  trimStart: number
  trimEnd: number

  // Phase 4 stubs
  outputBlob: Blob | null

  // Actions
  setFile: (file: File) => void
  setAudioBuffer: (buf: AudioBuffer) => void
  setStatus: (status: AppStatus, error?: string) => void
  reset: () => void
}

export const useTrimStore = create<TrimStore>((set) => ({
  file: null,
  audioBuffer: null,
  duration: 0,
  status: 'idle',
  errorMessage: null,
  trimStart: 0,
  trimEnd: 0,
  outputBlob: null,

  setFile: (file) => set({ file, status: 'decoding', errorMessage: null }),
  setAudioBuffer: (buf) =>
    set({ audioBuffer: buf, duration: buf.duration, trimEnd: buf.duration, status: 'ready' }),
  setStatus: (status, error = undefined) =>
    set({ status, errorMessage: error ?? null }),
  reset: () =>
    set({
      file: null,
      audioBuffer: null,
      duration: 0,
      status: 'idle',
      errorMessage: null,
      trimStart: 0,
      trimEnd: 0,
      outputBlob: null,
    }),
}))
