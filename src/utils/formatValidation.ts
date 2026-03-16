const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export type FormatCheckResult =
  | { valid: true; container: 'webm' }
  | { valid: false; container: 'webp' | 'riff' | 'unknown'; reason: string }

export async function checkFileFormat(file: File): Promise<FormatCheckResult> {
  const slice = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(slice)

  if (WEBM_MAGIC.every((b, i) => bytes[i] === b)) {
    return { valid: true, container: 'webm' }
  }

  if (RIFF_MAGIC.every((b, i) => bytes[i] === b)) {
    return {
      valid: false,
      container: 'webp',
      reason:
        'This file uses the RIFF/WebP container format, which does not support audio. Load a .webm file recorded by Chrome or another WebM-compatible tool.',
    }
  }

  return {
    valid: false,
    container: 'unknown',
    reason: `Unrecognised file format (magic bytes: ${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')}). Load a .webm audio file.`,
  }
}
