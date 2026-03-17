# Phase 4: Trim Execution and Download - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

User can execute a trim via ffmpeg.wasm, see original and trimmed file sizes, and download the result — all client-side. Real-time size estimates update while dragging handles. Progress feedback during processing. Error handling keeps the app usable on failure. No playback preview, no format conversion — those are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Trim + download flow
- **Two-step flow**: "Trim" button processes the file, then a "Download" button appears with size comparison
- User sees `Original: X KB → Trimmed: Y KB (Z% smaller)` before choosing to download
- Re-trimmable: after trim completes, handles stay editable; user can adjust and click "Trim" again, replacing the previous result
- Moving handles after a trim **clears the previous result** — download button and trimmed size disappear; user must re-trim
- Downloaded file named `trimmed_originalname.webm` (prefixed with `trimmed_`)

### Button behavior
- Trim button placed **below the numeric trim controls** (top-to-bottom flow: waveform → inputs → button)
- Trim button **disabled** when start=0 and end=duration (no-op trim prevented)
- Button disabled during processing with progress feedback

### Size display
- **Original file size shown immediately on load** in the file info area (e.g., `sample.webm • 5.2s • 252 KB`)
- After trim: trimmed size appears with percentage reduction
- **Real-time estimated size updates continuously while dragging** handles (linear proportion: trimmed duration / total duration × file size)

### Claude's Discretion
- Progress indicator style (spinner, bar, percentage — whatever fits the UI)
- Error message design and placement on trim failure
- Exact size formatting (KB vs MB threshold, decimal places)
- Button styling, hover/disabled states
- Layout spacing between trim controls and action buttons
- Whether to show a "Trim Again" label vs keeping the same "Trim" button after first trim

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — ffmpeg.wasm version, API patterns, WASM loading strategy
- `.planning/research/ARCHITECTURE.md` — Two-decode strategy, component boundaries, data flow
- `.planning/research/PITFALLS.md` — WASM memory leaks, VFS cleanup requirements, trim accuracy

### Project context
- `.planning/PROJECT.md` — Format: WebM/Opus confirmed, ffmpeg flags (`-c:a libopus`, `-f webm`), downstream implications

### Phase 3 outputs
- `src/store/trimStore.ts` — Zustand store with trimStart/trimEnd, outputBlob stub, setTrimStart/setTrimEnd actions
- `src/services/ffmpeg.ts` — FFmpeg singleton with ensureLoaded() guard, fetchFile export
- `src/components/TrimControls.tsx` — Numeric inputs component (trim button goes below this)
- `src/App.tsx` — Current layout: FileLoader → file info → WaveformView → TrimControls

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/ffmpeg.ts` — FFmpeg singleton with `ensureLoaded()`, `fetchFile` — core of trim execution
- `src/store/trimStore.ts` — Already has `outputBlob` field (null), `trimStart`/`trimEnd` with clamping, `file` and `duration`
- `src/utils/formatValidation.ts` — Format validation utility (reference for utility pattern)
- `src/components/TrimControls.tsx` — Numeric inputs; trim button renders below this component

### Established Patterns
- Zustand store as single source of truth — components read via selectors, events write via actions
- Service pattern: singleton with `ensureLoaded()` guard (ffmpeg.ts)
- CSS in `App.css` — plain CSS classes, no CSS modules or Tailwind
- Component files in `src/components/`, services in `src/services/`, store in `src/store/`

### Integration Points
- `trimStore.ts` — Add trim execution state (processing flag), `setOutputBlob` action, estimated size derived state
- `ffmpeg.ts` — Add trim function: write input to VFS, run ffmpeg command, read output, cleanup VFS, return Blob
- `App.tsx` — Add trim button, download button, size display, progress indicator below TrimControls
- File info section in App.tsx — Add original file size display on load

</code_context>

<specifics>
## Specific Ideas

- Two-step flow chosen so user can see size comparison before committing to download
- "Hide stale result" pattern: moving handles after trim clears output — clean, unambiguous state
- Real-time estimate uses simple linear proportion (no actual processing during drag)
- User liked the preview mockup: `Original: 252 KB → Trimmed: 180 KB (29% smaller)`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-trim-execution-and-download*
*Context gathered: 2026-03-17*
