# WebP Trimmer

## What This Is

A browser-based tool for trimming WebM audio files. Users load a file, see the waveform, select a portion to keep via drag handles or numeric inputs, trim via ffmpeg.wasm, and download the result — all client-side with no server.

## Core Value

Users can quickly trim the duration of a WebM audio file in the browser and save a smaller version without leaving the page or uploading to a server.

## Requirements

### Validated

- ✓ Load WebM files with audio via file picker — v1.0
- ✓ Display audio waveform visualization of the loaded file — v1.0
- ✓ Trim from start and/or end using draggable waveform handles — v1.0
- ✓ Manual numeric inputs for precise trim points (seconds to cut from start/end) — v1.0
- ✓ Save/download the trimmed file as WebM — v1.0
- ✓ Show file size before and after trimming — v1.0
- ✓ Real-time estimated output size while dragging handles — v1.0
- ✓ Progress indicator during WASM load and trim operations — v1.0
- ✓ Runs entirely client-side (no server, no uploads) — v1.0
- ✓ Works in modern browsers (Chrome, Firefox, Safari) — v1.0
- ✓ Format validation with clear error messages for unsupported files — v1.0
- ✓ Keyboard nudge for trim handles (arrow keys) — v1.0
- ✓ Bidirectional sync between waveform handles and numeric inputs — v1.0
- ✓ Supports files up to 130MB — v1.0

### Active

- [ ] Play/preview the trimmed audio region before saving
- [ ] Fade in/out effects at trim boundaries
- [ ] Load files via drag-and-drop
- [ ] Touch-friendly trim handle interaction on mobile devices

### Out of Scope

- Format conversion (MP3, WAV, etc.) — output stays WebM
- Image/frame editing — audio timeline trimming only
- Cloud storage save — defeats client-side simplicity story
- Batch file processing — single file focus keeps UX clear
- Server-side processing — privacy and simplicity requirement
- Undo/redo history — re-draggable handles provide equivalent

## Context

Shipped v1.0 with 1,077 LOC TypeScript/TSX/CSS.
Tech stack: Vite 6.4.1, React 19, TypeScript, wavesurfer.js v7, ffmpeg.wasm 0.12.x, Zustand.
Input files are WebM containers with Opus audio codec (not WebP as originally assumed — confirmed by ffprobe in Phase 1).
Stream copy (`-c copy`) used for trimming to avoid WASM memory limits on large files. WORKERFS mount avoids copying input into WASM memory.

## Constraints

- **Runtime**: Pure client-side — no backend, no file uploads
- **Output format**: WebM container with Opus audio
- **Browser APIs**: Modern browsers (Chrome, Firefox, Safari)
- **File size**: Up to 130MB

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only | Privacy, simplicity, no hosting costs | ✓ Good |
| Container format: WebM (not WebP) | ffprobe confirms `format_name=matroska,webm`; EBML magic bytes | ✓ Good |
| Audio codec: Opus | ffprobe: `codec_name=opus`, 48000 Hz mono | ✓ Good |
| Single-threaded ffmpeg.wasm | Avoids COOP/COEP complexity; deploys to any static host | ✓ Good |
| Two-decode strategy | Web Audio API for waveform, ffmpeg.wasm only at trim time | ✓ Good |
| wavesurfer.js v7 + Regions plugin | Drag handles out of the box; Web Audio API for decode | ✓ Good |
| Zustand for state management | Single source of truth prevents bidirectional sync bugs | ✓ Good |
| Stream copy (-c copy) over re-encode (-c:a libopus) | Avoids WASM memory crash on large files; Opus packets are all keyframes | ✓ Good |
| WORKERFS mount for input | Zero-copy file access avoids doubling memory usage | ✓ Good |
| ESM build of ffmpeg-core (not UMD) | UMD fails with dynamic import() under COEP require-corp | ✓ Good |
| toBlobURL for WASM loading | Required for COEP-safe dynamic import() of ffmpeg-core | ✓ Good |

---
*Last updated: 2026-03-17 after v1.0 milestone*
