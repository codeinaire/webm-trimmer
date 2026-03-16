---
phase: 02-file-load-and-waveform
plan: 01
subsystem: data-layer
tags: [zustand, format-validation, audio-decoder, web-audio-api]
dependency_graph:
  requires: []
  provides: [useTrimStore, checkFileFormat, decodeForWaveform]
  affects: [02-02]
tech_stack:
  added: []
  patterns: [zustand-store, magic-byte-validation, lazy-audiocontext-singleton]
key_files:
  created:
    - src/store/trimStore.ts
    - src/utils/formatValidation.ts
    - src/services/audioDecoder.ts
  modified: []
decisions:
  - "Re-read File in Phase 4 rather than storing ArrayBuffer in Zustand (File objects are not consumed)"
  - "arrayBuffer.slice(0) in decodeForWaveform preserves original buffer for ffmpeg.wasm Phase 4"
metrics:
  duration: ~10min
  completed: 2026-03-16
---

# Phase 2 Plan 1: Data Layer (Store, Format Validation, Audio Decoder) Summary

**One-liner:** Zustand store with typed AppStatus, magic-byte WebM/RIFF validator, and lazy AudioContext decoder service using slice(0) copy pattern.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Zustand store and format validation utility | 0ac25e1 | src/store/trimStore.ts, src/utils/formatValidation.ts |
| 2 | Create audio decoder service | e1ee4fb | src/services/audioDecoder.ts |

---

## What Was Built

### src/store/trimStore.ts
Zustand store exporting `useTrimStore`. Holds Phase 2 fields (`file`, `audioBuffer`, `duration`, `status`, `errorMessage`) and Phase 3/4 stubs (`trimStart`, `trimEnd`, `outputBlob`). Actions: `setFile` (→ decoding status), `setAudioBuffer` (→ ready + sets duration/trimEnd), `setStatus`, `reset`.

### src/utils/formatValidation.ts
Magic-byte format checker. WEBM (`1a 45 df a3`) → valid. RIFF (`52 49 46 46`) → invalid with RIFF/WebP error message. Unknown → invalid with hex bytes in message. Exports `MAX_FILE_SIZE = 50MB` for callers to guard before decode.

### src/services/audioDecoder.ts
Lazy AudioContext singleton. `decodeForWaveform(arrayBuffer)` calls `ctx.decodeAudioData(arrayBuffer.slice(0))` — the `slice(0)` preserves the original buffer for Phase 4 ffmpeg.wasm use without detaching it.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Verification

- `npx tsc --noEmit` passes with zero errors
- All three files exist and export their public APIs
- No runtime imports of ffmpeg.ts in any of these files

---

## Self-Check: PASSED

- src/store/trimStore.ts: FOUND
- src/utils/formatValidation.ts: FOUND
- src/services/audioDecoder.ts: FOUND
- Commit 0ac25e1: FOUND
- Commit e1ee4fb: FOUND
