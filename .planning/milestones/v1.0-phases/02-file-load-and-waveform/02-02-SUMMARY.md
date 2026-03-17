---
phase: 02-file-load-and-waveform
plan: 02
subsystem: ui-components
tags: [react, wavesurfer, zustand, file-picker, waveform]
dependency_graph:
  requires: [02-01]
  provides: [FileLoader, WaveformView]
  affects: [03-trim-ui]
tech_stack:
  added: []
  patterns: [wavesurfer-peaks-api, destroy-before-recreate, zustand-read-in-component]
key_files:
  created:
    - src/components/FileLoader.tsx
    - src/components/WaveformView.tsx
  modified:
    - src/App.tsx
    - src/App.css
decisions:
  - "wavesurfer.js v7 uses load('', peaks, duration) not loadDecodedBuffer — extracted Float32Array channel data from AudioBuffer"
  - "WaveformView shows placeholder text when no audioBuffer; renders waveform container only when ready"
metrics:
  duration: ~15min
  completed: 2026-03-16
---

# Phase 2 Plan 2: UI Components (FileLoader, WaveformView, App layout) Summary

**One-liner:** FileLoader with magic-byte validation and size guard, WaveformView using wavesurfer.js v7 peaks API, and App.tsx with error/status/file-info display wired to Zustand store.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FileLoader and WaveformView components | ad5c5e7 | src/components/FileLoader.tsx, src/components/WaveformView.tsx |
| 2 | Wire App.tsx with real layout and error display | 2f69783 | src/App.tsx, src/App.css |

---

## What Was Built

### src/components/FileLoader.tsx
File picker button wrapping a hidden `<input type="file">` accepting `.webm,audio/webm,video/webm`. On file select: calls `checkFileFormat` (magic-byte validation), guards on `MAX_FILE_SIZE` (50MB), calls `setFile` (→ decoding status), reads `arrayBuffer`, calls `decodeForWaveform`, calls `setAudioBuffer`. Error paths call `setStatus('error', reason)`. Input value reset after each selection so same file can be re-selected.

### src/components/WaveformView.tsx
Renders waveform using wavesurfer.js v7 `load('', channelData, duration)` API with pre-extracted `Float32Array` channel data from the `AudioBuffer`. Calls `wsRef.current?.destroy()` before each new instance creation (prevents memory leak / visual corruption on second load). Shows placeholder text when no `audioBuffer` in store.

### src/App.tsx
Replaces Phase 1 smoke test. Reads `status`, `errorMessage`, `file`, `duration` from `useTrimStore`. Renders: app title, `<FileLoader>`, conditional error box (red, when `status === 'error'`), conditional decoding text, conditional file info (name + duration in seconds), and `<WaveformView>`.

### src/App.css
Minimal clean layout: centered 800px container, styled file-loader button, red error box, decoding text, file info row, waveform container with border, placeholder with dashed border.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wavesurfer.js v7 API: `loadDecodedBuffer` does not exist**
- **Found during:** Task 1 → confirmed at build in Task 2
- **Issue:** Plan specified `wsRef.current.loadDecodedBuffer(audioBuffer)` but wavesurfer.js v7.12.3 types do not export this method. The installed version's public API is `load(url, channelData?, duration?)` and `loadBlob(blob, channelData?, duration?)`.
- **Fix:** Extract `Float32Array` channel data from `AudioBuffer` using `getChannelData(i)`, then call `ws.load('', channelData, audioBuffer.duration)` — the documented v7 path for pre-decoded peaks.
- **Files modified:** src/components/WaveformView.tsx
- **Commit:** 2f69783

---

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` exits 0 (238KB JS bundle)
- All acceptance criteria grep checks pass
- Task 3 checkpoint pending: browser verification of waveform rendering

---

## Self-Check: PASSED

- src/components/FileLoader.tsx: FOUND
- src/components/WaveformView.tsx: FOUND
- src/App.tsx: FOUND (contains FileLoader, WaveformView, errorMessage, status checks, duration)
- src/App.css: FOUND
- Commit ad5c5e7: FOUND
- Commit 2f69783: FOUND
