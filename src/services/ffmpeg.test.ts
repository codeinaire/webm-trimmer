import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to declare mocks that are referenced in vi.mock factory
const {
  mockExec,
  mockWriteFile,
  mockReadFile,
  mockDeleteFile,
  mockOn,
  mockOff,
  mockLoad,
} = vi.hoisted(() => ({
  mockExec: vi.fn().mockResolvedValue(0),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  mockDeleteFile: vi.fn().mockResolvedValue(undefined),
  mockOn: vi.fn(),
  mockOff: vi.fn(),
  mockLoad: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: mockLoad,
    exec: mockExec,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    deleteFile: mockDeleteFile,
    on: mockOn,
    off: mockOff,
    loaded: false,
  })),
}))

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array([10, 20, 30])),
  toBlobURL: vi.fn().mockResolvedValue('blob:mock'),
}))

import { trimAudio } from './ffmpeg'

describe('trimAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mockExec.mockResolvedValue(0)
    mockDeleteFile.mockResolvedValue(undefined)
    mockLoad.mockResolvedValue(undefined)
  })

  it('returns a Blob with type audio/webm', async () => {
    const file = new File([new Uint8Array([1])], 'test.webm', { type: 'audio/webm' })
    const blob = await trimAudio(file, 1.0, 3.0)
    expect(blob instanceof Blob).toBe(true)
    expect(blob.type).toBe('audio/webm')
  })

  it('calls deleteFile twice in finally block even when exec throws', async () => {
    mockExec.mockRejectedValueOnce(new Error('exec failed'))
    const file = new File([new Uint8Array([1])], 'test.webm', { type: 'audio/webm' })
    await expect(trimAudio(file, 0, 5)).rejects.toThrow('exec failed')
    expect(mockDeleteFile).toHaveBeenCalledTimes(2)
  })

  it('calls ffmpeg.off in finally block when onProgress was provided', async () => {
    const file = new File([new Uint8Array([1])], 'test.webm', { type: 'audio/webm' })
    const onProgress = vi.fn()
    await trimAudio(file, 0, 5, onProgress)
    expect(mockOn).toHaveBeenCalledTimes(1)
    expect(mockOn).toHaveBeenCalledWith('progress', expect.any(Function))
    expect(mockOff).toHaveBeenCalledTimes(1)
    expect(mockOff).toHaveBeenCalledWith('progress', expect.any(Function))
    // Verify same handler reference used for on and off
    const onHandler = mockOn.mock.calls[0][1]
    const offHandler = mockOff.mock.calls[0][1]
    expect(onHandler).toBe(offHandler)
  })

  it('does NOT call ffmpeg.on or ffmpeg.off when no onProgress provided', async () => {
    const file = new File([new Uint8Array([1])], 'test.webm', { type: 'audio/webm' })
    await trimAudio(file, 0, 5)
    expect(mockOn).not.toHaveBeenCalled()
    expect(mockOff).not.toHaveBeenCalled()
  })

  it('calls exec with correct ffmpeg arguments including -ss, -to, -c:a libopus, -f webm', async () => {
    const file = new File([new Uint8Array([1])], 'test.webm', { type: 'audio/webm' })
    await trimAudio(file, 1.5, 4.2)
    expect(mockExec).toHaveBeenCalledWith(
      expect.arrayContaining(['-ss', '1.5', '-to', '4.2', '-c:a', 'libopus', '-f', 'webm']),
    )
  })
})
