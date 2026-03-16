# Phase 2: File Load and Waveform - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

User can load a WebM audio file via file picker and immediately see its audio waveform. Unsupported files show a clear error. No trimming, no playback, no download — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Waveform appearance (color, height, style) — use wavesurfer.js defaults or whatever looks clean
- Error message design and tone for unsupported files
- Page layout and component structure around the waveform
- File picker styling and placement
- Loading states during audio decode
- How format identification (WebM vs other) is displayed to the user

### Carrying Forward from Phase 1
- Format is WebM/Opus (confirmed by ffprobe) — accept `.webm` files
- `AudioContext.decodeAudioData` natively handles WebM/Opus — use for waveform rendering
- Two-decode strategy: Web Audio API for waveform display, ffmpeg.wasm only at trim time (Phase 4)
- wavesurfer.js v7 with Regions plugin for waveform (already installed in package.json)
- Zustand for state management (already installed)
- `src/services/ffmpeg.ts` singleton exists but NOT needed for this phase (waveform uses Web Audio API)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — wavesurfer.js version and config recommendations
- `.planning/research/ARCHITECTURE.md` — Two-decode strategy, component boundaries, data flow
- `.planning/research/PITFALLS.md` — Waveform crash bugs on large files, wavesurfer.js destroy() requirement

### Phase 1 outputs
- `.planning/PROJECT.md` — Confirmed format: WebM/Opus, ffprobe results, downstream implications
- `src/services/ffmpeg.ts` — Existing singleton (not needed for waveform, but pattern reference)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/ffmpeg.ts` — FFmpeg singleton pattern (reference for service architecture)
- `src/store/` — Zustand store directory (empty, ready for trim state store)
- `src/components/` — Components directory (empty, ready for waveform component)
- `src/utils/` — Utils directory (empty, ready for audio decode utility)

### Established Patterns
- Service pattern: singleton with `ensureLoaded()` guard (from ffmpeg.ts)
- Vite config has COOP/COEP headers and `optimizeDeps.exclude` already set

### Integration Points
- `src/App.tsx` — Currently a smoke test; will be replaced with actual app UI
- `src/sample/sample.webm` — Real test file available for development

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all visual/UX decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-file-load-and-waveform*
*Context gathered: 2026-03-16*
