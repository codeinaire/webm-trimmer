import { describe, it, expect, beforeEach } from 'vitest'
import { useTrimStore } from './trimStore'

describe('trimStore extensions', () => {
  beforeEach(() => {
    useTrimStore.getState().reset()
  })

  it('clearOutput sets outputBlob to null and trimProgress to 0', () => {
    useTrimStore.setState({ outputBlob: new Blob(['test']), trimProgress: 0.5 })
    useTrimStore.getState().clearOutput()
    const state = useTrimStore.getState()
    expect(state.outputBlob).toBeNull()
    expect(state.trimProgress).toBe(0)
  })

  it('setTrimStart clears outputBlob', () => {
    useTrimStore.setState({ outputBlob: new Blob(['test']), trimEnd: 5, duration: 10 })
    useTrimStore.getState().setTrimStart(1)
    expect(useTrimStore.getState().outputBlob).toBeNull()
  })

  it('setTrimEnd clears outputBlob', () => {
    useTrimStore.setState({ outputBlob: new Blob(['test']), trimStart: 0, duration: 10 })
    useTrimStore.getState().setTrimEnd(8)
    expect(useTrimStore.getState().outputBlob).toBeNull()
  })

  it('setIsProcessing toggles isProcessing', () => {
    useTrimStore.getState().setIsProcessing(true)
    expect(useTrimStore.getState().isProcessing).toBe(true)
    useTrimStore.getState().setIsProcessing(false)
    expect(useTrimStore.getState().isProcessing).toBe(false)
  })

  it('setOutputBlob stores blob', () => {
    const blob = new Blob(['output data'], { type: 'audio/webm' })
    useTrimStore.getState().setOutputBlob(blob)
    expect(useTrimStore.getState().outputBlob).toBe(blob)
  })

  it('reset clears isProcessing and trimProgress', () => {
    useTrimStore.setState({ isProcessing: true, trimProgress: 0.7 })
    useTrimStore.getState().reset()
    const state = useTrimStore.getState()
    expect(state.isProcessing).toBe(false)
    expect(state.trimProgress).toBe(0)
  })
})
