# WebP Trimmer

## What This Is

A browser-based tool for trimming WebP files that contain audio. Users load a WebP file, visually select a portion of the audio timeline to keep (trimming from the start and/or end), preview the result, and download the trimmed file — all client-side with no server.

## Core Value

Users can quickly trim the duration of a WebP audio file in the browser and save a smaller version without leaving the page or uploading to a server.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load WebP files with audio via file picker or drag-and-drop
- [ ] Display audio waveform visualization of the loaded file
- [ ] Trim from start and/or end using draggable waveform handles
- [ ] Manual numeric inputs for precise trim points (seconds to cut from start/end)
- [ ] Play/preview the trimmed audio before saving
- [ ] Save/download the trimmed file as WebP
- [ ] Show file size before and after trimming
- [ ] Runs entirely client-side (no server, no uploads)

### Out of Scope

- Image compression or quality adjustment — this is duration trimming only
- Format conversion (MP3, WAV, etc.) — output stays WebP
- Video editing or frame manipulation — audio timeline trimming only
- Server-side processing — everything runs in the browser
- Mobile-optimized UI — desktop browser is the primary target

## Context

WebP files can contain audio data (similar to WebM containers). The tool needs to parse the WebP container format, extract audio, render a waveform, allow trimming, and re-encode back to WebP. FFmpeg compiled to WASM (e.g., ffmpeg.wasm) is the likely approach for client-side audio processing in the browser.

## Constraints

- **Runtime**: Pure client-side — no backend, no file uploads
- **Output format**: Must output valid WebP files (not convert to other formats)
- **Browser APIs**: Must work in modern browsers (Chrome, Firefox, Safari)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only | Privacy, simplicity, no hosting costs | — Pending |
| WebP in, WebP out | User wants to keep the same format | — Pending |
| Waveform + numeric inputs | Visual for quick trimming, numbers for precision | — Pending |

---
*Last updated: 2026-03-16 after initialization*
