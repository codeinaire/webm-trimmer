# Phase 3: Trim Interaction - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

User can set precise trim points using draggable waveform handles and numeric inputs, with bidirectional sync between all controls. Arrow key nudge supported. No actual trimming, no download — those are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Carrying Forward from Prior Phases
- wavesurfer.js v7 with Regions plugin — already installed, provides drag handles out of the box
- Zustand single source of truth — region events push trimStart/trimEnd to store; numeric inputs read from store
- `trimStart`/`trimEnd` already stubbed in `trimStore.ts` (0 and duration on file load)
- Requirements specify "seconds to cut from start/end" as the numeric input model
- WaveformView currently has `interact: false` — Phase 3 enables interaction via Regions plugin

### Claude's Discretion
- Trim region visual treatment (colors, opacity, dimming of cut portions)
- Numeric input placement, formatting, and decimal precision
- Arrow key nudge step size (e.g., 0.1s default, Shift+arrow for larger jumps)
- Handle focus behavior and keyboard interaction model
- Layout of trim controls relative to waveform
- Validation UX for preventing invalid states (start > end)
- How "cut from start" / "cut from end" values are displayed vs internal trimStart/trimEnd representation
- Any visual feedback during drag operations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — wavesurfer.js version, Regions plugin config recommendations
- `.planning/research/ARCHITECTURE.md` — Two-decode strategy, component boundaries, Zustand data flow
- `.planning/research/PITFALLS.md` — wavesurfer.js destroy() requirement, region event handling gotchas

### Phase 2 outputs
- `.planning/phases/02-file-load-and-waveform/02-CONTEXT.md` — Waveform decisions, wavesurfer.js v7 API notes
- `src/components/WaveformView.tsx` — Current waveform implementation (interact: false, no regions)
- `src/store/trimStore.ts` — Zustand store with trimStart/trimEnd stubs, setAudioBuffer sets trimEnd=duration

### Phase 1 outputs
- `.planning/PROJECT.md` — Confirmed format: WebM/Opus, downstream implications

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/trimStore.ts` — Already has `trimStart`/`trimEnd` fields and `setAudioBuffer` initializes `trimEnd = duration`; needs new actions (`setTrimStart`, `setTrimEnd`) for handle/input updates
- `src/components/WaveformView.tsx` — wavesurfer.js instance managed via refs; Regions plugin attaches here
- `wavesurfer.js` Regions plugin — installed via `wavesurfer.js` package (import from `wavesurfer.js/dist/plugins/regions`)

### Established Patterns
- Zustand store as single source of truth — components read via selectors, events write via actions
- wavesurfer.js lifecycle: destroy before recreate, ref-based instance management
- Service pattern: singleton with guard (from ffmpeg.ts — reference for any new services)

### Integration Points
- `WaveformView.tsx` — Add Regions plugin, create a region spanning trimStart→trimEnd, listen for region-update events
- `App.tsx` — Add TrimControls component (numeric inputs) below the waveform
- `trimStore.ts` — Add `setTrimStart`/`setTrimEnd` actions with clamping logic (prevent start > end)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user deferred all visual/UX decisions to Claude. Open to standard approaches that satisfy the requirements.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-trim-interaction*
*Context gathered: 2026-03-16*
