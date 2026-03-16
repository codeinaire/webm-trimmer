# Project State: WebP Trimmer

*This file is the project's memory. Update it at every meaningful transition.*

---

## Project Reference

**Core Value:** Users can quickly trim the duration of a WebP audio file in the browser and save a smaller version without leaving the page or uploading to a server.
**Current Focus:** Phase 1 — Foundation

---

## Current Position

**Phase:** 1 — Foundation
**Plan:** 02 complete (01-02-PLAN.md)
**Status:** In progress
**Last Action:** Completed plan 01-02 — ffprobe format validation; WebM/Opus confirmed

### Progress Bar

```
Phase 1 [####------] 40%
Phase 2 [----------] 0%
Phase 3 [----------] 0%
Phase 4 [----------] 0%
```

**Overall:** 0/4 phases complete (Phase 1 in progress: 2/2 foundation plans done)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 4 |
| Phases complete | 0 |
| Requirements total | 14 |
| Requirements done | 2 |
| Plans written | 1 |
| Plans complete | 1 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Client-side only (no server) | Privacy, simplicity, no hosting costs | Confirmed in requirements |
| Single-threaded ffmpeg.wasm core | Avoids COOP/COEP header requirement; deploys to any static host | Confirmed — @ffmpeg/core@0.12.10 installed |
| Container format: WebM (not WebP) | ffprobe: `format_name=matroska,webm`; magic bytes `1a 45 df a3` (EBML). Input sample encoded by Chrome. Output: `.webm`, `audio/webm`. | Confirmed in Phase 1 |
| Audio codec: Opus | ffprobe: `codec_name=opus`, 48000 Hz mono. ffmpeg flag: `-c:a libopus` | Confirmed in Phase 1 |
| Vite 6.4.1 + React 19 + TypeScript | Vite 8 requires Node 20.19+; system has 20.16.0; Vite 6 fully functional | Confirmed in 01-01 execution |
| @ffmpeg/util@0.12.2 (not 0.12.10) | npm registry only has util versions up to 0.12.2; plan had incorrect version | Confirmed in 01-01 execution |
| wavesurfer.js v7 + Regions plugin | Provides drag handles out of the box; Web Audio API for waveform decode | Pending Phase 2 |
| Zustand for trim state | Single source of truth prevents bidirectional sync bugs | Pending Phase 2 scaffold |

### Critical Risks

1. **Format ambiguity** — WebP spec has no audio chunks. Input files may be WebM containers mislabeled as WebP. Phase 1 must confirm with `ffprobe` on real files before any implementation.
2. **COOP/COEP headers** — Multi-threaded WASM requires these headers; most static hosts do not set them. Use single-threaded `@ffmpeg/core` unless host is confirmed.
3. **WASM memory leaks** — `ffmpeg.deleteFile()` must be called after every trim for both input and output files. `URL.revokeObjectURL()` must be called after download. These are correctness requirements, not polish.
4. **Trim inaccuracy** — Use `-c:a libopus` re-encode (not `-c copy`) for sample-accurate cuts. Stream copy only cuts at keyframe boundaries.

### Architecture Notes

- Two-decode strategy: Web Audio API decodes for waveform display immediately; ffmpeg.wasm decodes only at trim time
- WaveSurfer is write-only for state purposes: region events push to Zustand store; all other components read from store
- ffmpeg service is a singleton (`src/services/ffmpeg.ts`) with `ensureLoaded` guard — CONFIRMED WORKING
- VFS cleanup (`deleteFile`) and Blob URL cleanup (`revokeObjectURL`) are required in the trim function

### Open Questions

1. ~~Are input files true WebP containers with non-standard audio, or WebM containers with a `.webp` extension?~~ **RESOLVED (Phase 1):** Files are WebM containers (`matroska,webm`) with `.webm` extension. Not WebP. EBML magic bytes confirmed.
2. Where will the app be deployed? (Affects single-threaded vs multi-threaded WASM core choice) — Local only per user constraints; single-threaded confirmed.
3. ~~What audio codec do the input files use — Opus or Vorbis?~~ **RESOLVED (Phase 1):** Codec is `opus` (Opus Interactive Audio Codec), 48000 Hz mono, encoder=Chrome. ffmpeg flag: `-c:a libopus`.

### Todos

- [x] Run `ffprobe` on real input files to confirm container format — DONE: WebM/Opus confirmed
- [ ] Decide and document production deployment target (local-only per constraints; low priority)
- [x] Update PROJECT.md Key Decisions table after Phase 1 spike findings — DONE in Plan 01-02
- [ ] Update OUT-01 requirement to reflect `.webm` output (files are WebM, not WebP)

### Blockers

None. Phase 1 plan 01-01 complete. Next: browser smoke test confirmation (visit localhost:5173 and click button).

---

## Session Continuity

**To resume work, read:**
1. `.planning/STATE.md` (this file) — current position and context
2. `.planning/ROADMAP.md` — phase goals and success criteria
3. `.planning/REQUIREMENTS.md` — full requirement list with traceability
4. `.planning/phases/01-foundation/01-01-SUMMARY.md` — plan 01 execution summary

**Current phase plan location:** `.planning/phases/01-foundation/`

---

*State initialized: 2026-03-16*
*Last updated: 2026-03-16 after completing 01-02-PLAN.md (ffprobe format validation — WebM/Opus confirmed)*
