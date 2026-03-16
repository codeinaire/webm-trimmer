import { create } from 'zustand'

type AppStatus = 'idle' | 'decoding' | 'ready' | 'trimming' | 'error'

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

  // Phase 4 fields
  outputBlob: Blob | null
  isProcessing: boolean
  trimProgress: number

  // Actions
  setFile: (file: File) => void
  setAudioBuffer: (buf: AudioBuffer) => void
  setStatus: (status: AppStatus, error?: string) => void
  reset: () => void
  setTrimStart: (n: number) => void
  setTrimEnd: (n: number) => void
  setOutputBlob: (blob: Blob) => void
  clearOutput: () => void
  setIsProcessing: (v: boolean) => void
  setTrimProgress: (v: number) => void
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
  isProcessing: false,
  trimProgress: 0,

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
      isProcessing: false,
      trimProgress: 0,
    }),
  setTrimStart: (n) =>
    set((s) => ({
      trimStart: Math.max(0, Math.min(n, s.trimEnd - 0.01)),
      outputBlob: null,
    })),
  setTrimEnd: (n) =>
    set((s) => ({
      trimEnd: Math.max(s.trimStart + 0.01, Math.min(n, s.duration)),
      outputBlob: null,
    })),
  setOutputBlob: (blob) => set({ outputBlob: blob }),
  clearOutput: () => set({ outputBlob: null, trimProgress: 0 }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setTrimProgress: (v) => set({ trimProgress: v }),
}))
