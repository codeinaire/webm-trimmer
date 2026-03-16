import { describe, it, expect } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('formats 0 bytes as 0.0 KB', () => {
    expect(formatBytes(0)).toBe('0.0 KB')
  })

  it('formats 512 bytes as 0.5 KB', () => {
    expect(formatBytes(512)).toBe('0.5 KB')
  })

  it('formats 1024 bytes as 1.0 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('formats 258048 bytes as 252.0 KB', () => {
    expect(formatBytes(258048)).toBe('252.0 KB')
  })

  it('formats 1048575 bytes (1 byte below 1MB) as KB', () => {
    expect(formatBytes(1048575)).toMatch(/KB$/)
  })

  it('formats 1048576 bytes (exactly 1MB) as 1.0 MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('formats 1572864 bytes as 1.5 MB', () => {
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })

  it('formats 10485760 bytes as 10.0 MB', () => {
    expect(formatBytes(10485760)).toBe('10.0 MB')
  })
})
