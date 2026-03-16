# Project State: WebP Trimmer

*This file is the project's memory. Update it at every meaningful transition.*

---

## Project Reference

**Core Value:** Users can quickly trim the duration of a WebP audio file in the browser and save a smaller version without leaving the page or uploading to a server.
**Current Focus:** Phase 1 — Foundation

---

## Current Position

**Phase:** 1 — Foundation
**Plan:** None started
**Status:** Not started
**Last Action:** Roadmap created

### Progress Bar

```
Phase 1 [----------] 0%
Phase 2 [----------] 0%
Phase 3 [----------] 0%
Phase 4 [----------] 0%
```

**Overall:** 0/4 phases complete

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 4 |
| Phases complete | 0 |
| Requirements total | 14 |
| Requirements done | 0 |
| Plans written | 0 |
| Plans complete | 0 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Client-side only (no server) | Privacy, simplicity, no hosting costs | Confirmed in requirements |
| Single-threaded ffmpeg.wasm core | Avoids COOP/COEP header requirement; deploys to any static host | Pending Phase 1 confirmation |
| WebP or WebM output format | Actual container format of input files is unconfirmed | Must resolve in Phase 1 |
| React 19 + TypeScript + Vite 8 | Research-validated stack; Vite 8 required for WASM support | Pending Phase 1 scaffold |
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
- ffmpeg service must be a singleton with an `ensureLoaded` guard
- VFS cleanup (`deleteFile`) and Blob URL cleanup (`revokeObjectURL`) are required in the trim function

### Open Questions

1. Are input files true WebP containers with non-standard audio, or WebM containers with a `.webp` extension? (Resolve in Phase 1)
2. Where will the app be deployed? (Affects single-threaded vs multi-threaded WASM core choice)
3. What audio codec do the input files use — Opus or Vorbis? (Determines ffmpeg `-c:a` flag)

### Todos

- [ ] Run `ffprobe` on real input files to confirm container format
- [ ] Decide and document production deployment target
- [ ] Update PROJECT.md Key Decisions table after Phase 1 spike findings
- [ ] If files are WebM, update OUT-01 requirement to reflect `.webm` output

### Blockers

None currently. Phase 1 is ready to start.

---

## Session Continuity

**To resume work, read:**
1. `.planning/STATE.md` (this file) — current position and context
2. `.planning/ROADMAP.md` — phase goals and success criteria
3. `.planning/REQUIREMENTS.md` — full requirement list with traceability
4. `.planning/research/SUMMARY.md` — stack decisions and architecture rationale

**Current phase plan location:** `.planning/plans/phase-1/` (not yet created)

---

*State initialized: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation*
