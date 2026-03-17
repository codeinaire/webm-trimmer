# Phase 4: Trim Execution and Download - Research

**Researched:** 2026-03-17
**Domain:** ffmpeg.wasm trim execution, browser Blob download, real-time size estimation, React state management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Two-step flow**: "Trim" button processes the file, then a "Download" button appears with size comparison
- User sees `Original: X KB → Trimmed: Y KB (Z% smaller)` before choosing to download
- Re-trimmable: after trim completes, handles stay editable; user can adjust and click "Trim" again
- Moving handles after a trim **clears the previous result** — download button and trimmed size disappear; user must re-trim
- Downloaded file named `trimmed_originalname.webm` (prefixed with `trimmed_`)
- Trim button placed **below the numeric trim controls** (top-to-bottom flow: waveform → inputs → button)
- Trim button **disabled** when start=0 and end=duration (no-op trim prevented)
- Button disabled during processing with progress feedback
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OUT-01 | User can download the trimmed file as WebP (WebM) | ffmpeg.wasm trim function + Blob download via anchor click pattern |
| OUT-02 | App displays file size before and after trimming | `File.size` on load + `Blob.size` after trim; both available client-side |
| OUT-03 | App shows real-time estimated output size as handles are dragged | Linear proportion computed in Zustand selector: `(trimEnd - trimStart) / duration * file.size` |
| OUT-04 | App shows progress indicator during WASM load and trim operations | ffmpeg `progress` event callback + `isProcessing` flag in store |
</phase_requirements>

---

## Summary

Phase 4 completes the user journey: executing the trim via ffmpeg.wasm and downloading the result. All building blocks are already in place — `src/services/ffmpeg.ts` has the singleton with `ensureLoaded()`, `src/store/trimStore.ts` has `outputBlob`, and `TrimControls` is already mounted in `App.tsx`. This phase is primarily about wiring them together with the correct state machine and UI.

The two highest-risk areas are: (1) proper VFS and Blob URL cleanup to prevent memory leaks on repeated trims — these are correctness requirements that must be built into the trim function, not added later, and (2) the `isProcessing` state guard to prevent the user re-triggering a trim while one is in flight.

The real-time size estimate is a pure derived value from existing store fields — `(trimEnd - trimStart) / duration * file.size` — requiring no new async work. The download itself is a single-shot `URL.createObjectURL` + `<a download>` pattern with mandatory `revokeObjectURL` after click.

**Primary recommendation:** Add a `trimAudio` function to `src/services/ffmpeg.ts`, extend the store with `isProcessing` and `setOutputBlob`, wire a `TrimActions` component below `TrimControls` in `App.tsx`. All else is derived from existing state.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ffmpeg/ffmpeg` | 0.12.15 | Trim execution | Already installed, singleton in ffmpeg.ts |
| `@ffmpeg/core` | 0.12.10 | Single-threaded WASM binary | Already installed, confirmed working |
| `@ffmpeg/util` | 0.12.2 | `fetchFile`, `toBlobURL` helpers | Already installed |
| Zustand | 5.0.12 | State machine for processing status | Already installed, established pattern |

### No New Dependencies Required
All libraries needed for Phase 4 are already installed. No additional `npm install` needed.

---

## Architecture Patterns

### Recommended Project Structure (Phase 4 additions)

```
src/
├── components/
│   ├── TrimControls.tsx      # EXISTING — unchanged
│   └── TrimActions.tsx       # NEW — trim button, download button, size display
├── services/
│   └── ffmpeg.ts             # EXTEND — add trimAudio() function
├── store/
│   └── trimStore.ts          # EXTEND — add isProcessing, setOutputBlob, clearOutput
└── App.tsx                   # EXTEND — render TrimActions below TrimControls
```

### Pattern 1: ffmpeg.wasm Trim Function with Mandatory Cleanup

**What:** Write input to VFS, exec ffmpeg with `-ss`/`-to`/`-c:a libopus`/`-f webm`, read output, delete both VFS entries, return Blob. Cleanup is part of the function — not caller responsibility.

**When to use:** Every trim invocation.

**Key ffmpeg command flags:**
```typescript
// Source: STATE.md confirmed codec decisions + PITFALLS.md Pitfall 5
await ffmpeg.exec([
  '-ss', String(trimStart),
  '-to', String(trimEnd),
  '-i', inputName,
  '-c:a', 'libopus',   // re-encode for sample-accurate cuts (not -c copy)
  '-f', 'webm',
  outputName,
])
```

Use `-ss` and `-to` BEFORE `-i` for faster seeking (input seeking). For audio-only with re-encode, order matters less but pre-input placement is the recommended pattern.

**Full trim function pattern:**
```typescript
// Source: ARCHITECTURE.md Pattern 1 + PITFALLS.md Pitfall 4
export async function trimAudio(
  file: File,
  trimStart: number,
  trimEnd: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  await ensureLoaded()

  const inputName = `input_${Date.now()}.webm`
  const outputName = `output_${Date.now()}.webm`

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    await ffmpeg.exec([
      '-ss', String(trimStart),
      '-to', String(trimEnd),
      '-i', inputName,
      '-c:a', 'libopus',
      '-f', 'webm',
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName) as Uint8Array
    return new Blob([data], { type: 'audio/webm' })
  } finally {
    // Mandatory cleanup — always runs even on error
    ffmpeg.deleteFile(inputName).catch(() => {})
    ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
```

**Critical notes:**
- Use unique filenames with `Date.now()` to avoid stale data on repeat trims (PITFALLS.md integration gotchas)
- Wrap cleanup in `finally` so it runs even on ffmpeg error
- `deleteFile` may throw if file doesn't exist (e.g., exec failed before write completed) — swallow with `.catch(() => {})`

### Pattern 2: Store Extension for Processing State

**What:** Add `isProcessing: boolean`, `setOutputBlob`, `clearOutput` to the existing Zustand store. The `AppStatus` type needs a `'trimming'` value.

```typescript
// Extend AppStatus in trimStore.ts
type AppStatus = 'idle' | 'decoding' | 'ready' | 'trimming' | 'error'

// New store fields
isProcessing: boolean         // true while ffmpeg.exec is running
outputBlob: Blob | null       // existing stub — populate this

// New actions
setOutputBlob: (blob: Blob) => void
clearOutput: () => void       // called when handles move after trim
setIsProcessing: (v: boolean) => void
```

The `clearOutput` action must be called from `setTrimStart` and `setTrimEnd` when an `outputBlob` exists — this is the "moving handles clears stale result" requirement.

**Modified setTrimStart/setTrimEnd pattern:**
```typescript
setTrimStart: (n) =>
  set((s) => ({
    trimStart: Math.max(0, Math.min(n, s.trimEnd - 0.01)),
    outputBlob: null,  // clear stale result when position changes
  })),
```

### Pattern 3: Real-Time Size Estimate (Derived State)

**What:** Compute estimated output size during dragging without any async work.

```typescript
// In TrimActions component — pure computation from store values
const { trimStart, trimEnd, duration, file } = useTrimStore()

const estimatedBytes = file
  ? Math.round((trimEnd - trimStart) / duration * file.size)
  : null
```

This runs on every render triggered by trimStart/trimEnd changes. No debouncing needed — it's a pure calculation with no side effects.

### Pattern 4: Browser File Download

**What:** Create an object URL from the output Blob, simulate an anchor click, then revoke the URL.

```typescript
// Source: MDN Web API docs — URL.createObjectURL / revokeObjectURL
function triggerDownload(blob: Blob, originalName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trimmed_${originalName}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick to let the browser start the download
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
```

**Safari note:** `<a download>` works in Safari but only for same-origin or Blob URLs. Since we're using `URL.createObjectURL` (a `blob:` URL), this works in Safari without issues. The `setTimeout` before revoke is a Safari compatibility requirement — revoking immediately can interrupt the download initiation.

### Pattern 5: Progress Feedback

**What:** Hook into ffmpeg's `progress` event to show trim progress. The existing `ensureLoaded()` already hooks `log` events. Progress is a number 0–1.

```typescript
// In trimAudio() — attach before exec, clean up after
const progressHandler = ({ progress }: { progress: number }) => {
  onProgress?.(progress)
}
ffmpeg.on('progress', progressHandler)
try {
  // ... exec ...
} finally {
  ffmpeg.off('progress', progressHandler)
  // ... deleteFile cleanup ...
}
```

For WASM load progress, the existing `ensureLoaded()` can be extended. However, since the WASM is likely already cached from Phase 2/3 usage, WASM load progress is low-priority for Phase 4. A simple "Loading..." state while `ensureLoaded()` resolves is sufficient.

### Anti-Patterns to Avoid

- **Using `-c copy` for trim:** Cuts at keyframe boundaries only — off by up to one codec frame. Always use `-c:a libopus` for sample-accurate Opus audio cuts.
- **Skipping `deleteFile` cleanup:** WASM heap grows on every operation. After 5-10 trims, the browser tab degrades.
- **Revoking Blob URL immediately:** `URL.revokeObjectURL` called synchronously before `a.click()` fires can fail in Safari. Use `setTimeout(..., 100)`.
- **Multiple `progress` listener registrations:** Calling `ffmpeg.on('progress', ...)` repeatedly without removing old listeners causes multiple callbacks per event. Store the handler reference and call `ffmpeg.off` in `finally`.
- **Blocking UI during trim:** The ffmpeg singleton runs in a Web Worker via the `@ffmpeg/ffmpeg` library. All calls are async — do NOT add `await` inside React event handlers without setting `isProcessing = true` first to prevent double-submission.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio trim/encode | Custom WASM or JS audio cutter | `ffmpeg.wasm` trim with `-c:a libopus` | Codec frame alignment, container muxing, metadata handling all handled by ffmpeg |
| File download | Custom download via fetch/XHR | `URL.createObjectURL` + `<a download>` | Browser-native, handles large files, works across all modern browsers |
| Size formatting | Custom `formatBytes` function | Simple inline ternary (`< 1024*1024 ? KB : MB`) | Scope is small; KB/MB with one decimal is sufficient |
| Progress display | Complex progress bar library | CSS width transition on a `<div>` | Adds no dependency; ffmpeg progress 0-1 maps directly to width percentage |

**Key insight:** The entire trim pipeline is already abstracted via ffmpeg.wasm. Phase 4 is wiring state and UI — no new algorithms required.

---

## Common Pitfalls

### Pitfall 1: WASM VFS Memory Leak on Repeated Trims
**What goes wrong:** `ffmpeg.writeFile()` allocates WASM heap. Without `ffmpeg.deleteFile()`, memory grows linearly with each trim.
**Why it happens:** `deleteFile` is not called automatically; errors in `exec` can leave files stranded.
**How to avoid:** Always put `deleteFile` in a `finally` block. Use `.catch(() => {})` on delete calls since the file may not exist if exec failed early.
**Warning signs:** DevTools Memory tab shows growing heap after repeated trims.

### Pitfall 2: Double-Trigger During Async Processing
**What goes wrong:** User clicks Trim twice; two ffmpeg execs run concurrently on the same singleton — second write may overlap with first read.
**Why it happens:** Button not disabled fast enough (React state update is async).
**How to avoid:** Set `isProcessing = true` as the very first thing in the click handler (synchronously via Zustand's `setState`). Check `isProcessing` in the button's `disabled` prop. The singleton pattern means concurrent execs share VFS state and will corrupt each other.

### Pitfall 3: Stale Output After Handle Move
**What goes wrong:** User trims, gets result, adjusts handles, but the old download button is still visible with the old trimmed size. User downloads the wrong file.
**Why it happens:** State not cleared when trim parameters change.
**How to avoid:** `setTrimStart` and `setTrimEnd` in the store must set `outputBlob: null` when called. This collapses the output panel automatically since it renders only when `outputBlob !== null`.

### Pitfall 4: `progress` Event Not Removed After Trim
**What goes wrong:** Multiple trim operations each register a new `progress` listener. After 5 trims, every progress tick calls 5 handlers, causing ghost UI updates or stale closures.
**Why it happens:** `ffmpeg.on('progress', fn)` does not auto-deregister.
**How to avoid:** Always `ffmpeg.off('progress', handler)` in the `finally` block of `trimAudio`.

### Pitfall 5: Estimated Size Shows When Both Are Full Duration
**What goes wrong:** On file load, `trimStart=0` and `trimEnd=duration`, so estimated size = 100% of file size — same as original. This is technically correct but confusing if displayed alongside the original size.
**Why it happens:** Linear proportion formula always returns 1.0 at full range.
**How to avoid:** Only show the estimated size line when the trim region is NOT the full file (i.e., when the Trim button is enabled). Or add a label like "Estimated: X KB (no trim)" to make it clear.

---

## Code Examples

### File Size Formatting
```typescript
// Source: standard pattern — no library needed for this scope
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

### Output Panel Conditional Rendering
```tsx
// TrimActions component structure
const { outputBlob, file, isProcessing, trimStart, trimEnd, duration } = useTrimStore()

const isNoOp = trimStart === 0 && trimEnd === duration
const estimatedBytes = file && duration > 0
  ? Math.round((trimEnd - trimStart) / duration * file.size)
  : null

// Trim button — disabled when no-op or processing
<button
  className="trim-button"
  disabled={isNoOp || isProcessing}
  onClick={handleTrim}
>
  {isProcessing ? 'Trimming…' : 'Trim'}
</button>

// Size display — always show estimated during drag when file loaded
{file && !isNoOp && (
  <p className="size-estimate">
    Estimated: {formatBytes(estimatedBytes!)}
  </p>
)}

// Download section — only after successful trim
{outputBlob && (
  <div className="output-panel">
    <p className="size-comparison">
      Original: {formatBytes(file!.size)} → Trimmed: {formatBytes(outputBlob.size)}
      {' '}({Math.round((1 - outputBlob.size / file!.size) * 100)}% smaller)
    </p>
    <button className="download-button" onClick={handleDownload}>
      Download
    </button>
  </div>
)}
```

### App.tsx File Info Extension (original size on load)
```tsx
// Extend existing file-info section in App.tsx
{status === 'ready' && file && (
  <div className="file-info">
    <span className="file-name">{file.name}</span>
    <span className="file-sep">•</span>
    <span className="file-duration">{duration.toFixed(1)}s</span>
    <span className="file-sep">•</span>
    <span className="file-size">{formatBytes(file.size)}</span>
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createFFmpeg` API (v0.11) | `new FFmpeg()` + `.load({ coreURL, wasmURL })` | v0.12.0 | Breaking change — old examples on StackOverflow are wrong |
| `-c copy` for audio trim | `-c:a libopus` re-encode | Always true for Opus | Stream copy can't do sub-keyframe cuts |
| Synchronous Blob download | `URL.createObjectURL` + `setTimeout(revokeObjectURL, 100)` | Safari compat requirement | Revoke too early breaks download in Safari |

**No deprecated APIs in use for Phase 4.** The existing `ffmpeg.ts` already uses the correct v0.12 API.

---

## Open Questions

1. **Progress granularity for short files**
   - What we know: ffmpeg `progress` event fires periodically during encode; for very short clips (<1s), it may fire 0 or 1 times
   - What's unclear: Whether progress feedback is worth building for the typical short clips in this project
   - Recommendation: Show a simple spinner (not a bar) during `isProcessing`. Spinner is always correct regardless of progress event frequency.

2. **Error message content for WASM failures**
   - What we know: ffmpeg.wasm may fail if the WASM binary is corrupted or if the browser runs out of heap
   - What's unclear: The exact error types thrown by `ffmpeg.exec` on failure
   - Recommendation: Catch all errors from `trimAudio`, set `status = 'error'` with a user-friendly message like "Trim failed — please reload the page and try again." Log the raw error to console.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.0 |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | `trimAudio()` returns a Blob with type `audio/webm` | unit | `npx vitest run src/services/ffmpeg.test.ts` | ❌ Wave 0 |
| OUT-02 | `formatBytes()` formats KB/MB correctly at boundary values | unit | `npx vitest run src/utils/formatBytes.test.ts` | ❌ Wave 0 |
| OUT-03 | Estimated size = `(trimEnd - trimStart) / duration * file.size` (derived formula) | unit | `npx vitest run src/store/trimStore.test.ts` | ❌ Wave 0 |
| OUT-04 | `isProcessing` prevents double-submit and is reset after trim completes or fails | unit | `npx vitest run src/store/trimStore.test.ts` | ❌ Wave 0 |

**Note:** `trimAudio()` unit tests will require mocking `@ffmpeg/ffmpeg` since actual WASM execution is not feasible in a test environment. The test should verify: correct VFS filenames used, `deleteFile` called in finally, returned Blob has correct MIME type.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/ffmpeg.test.ts` — covers OUT-01 (trimAudio Blob output, cleanup calls)
- [ ] `src/utils/formatBytes.test.ts` — covers OUT-02 (size display formatting)
- [ ] `src/store/trimStore.test.ts` — covers OUT-03 (estimated size formula), OUT-04 (isProcessing guard)
- [ ] `src/utils/formatBytes.ts` — utility function to extract and test (currently inline)

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — ffmpeg.wasm v0.12 API, VFS patterns, single-threaded core
- `.planning/research/ARCHITECTURE.md` — trim function pattern, download trigger, data flow
- `.planning/research/PITFALLS.md` — memory leak requirements, cleanup patterns, Safari Blob download
- `.planning/PROJECT.md` — Confirmed codec (`-c:a libopus`), format (`-f webm`), output MIME type
- `src/services/ffmpeg.ts` — existing singleton structure to extend
- `src/store/trimStore.ts` — existing state shape (outputBlob stub present)
- `src/App.tsx` + `src/App.css` — established CSS class naming convention
- MDN Web API — `URL.createObjectURL`, `URL.revokeObjectURL`, `<a download>`

### Secondary (MEDIUM confidence)
- ffmpeg.wasm GitHub issues #200, #494 — VFS cleanup requirements (multiple sources agree)
- Safari `<a download>` compatibility notes — setTimeout-before-revoke pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all dependencies confirmed installed
- Architecture: HIGH — patterns from official sources, confirmed working in prior phases
- Pitfalls: HIGH — from official ffmpeg.wasm GitHub issues + established project research
- Test strategy: MEDIUM — Vitest confirmed installed; test file structure follows project conventions but no test files exist yet

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain — ffmpeg.wasm 0.12.x is not actively releasing breaking changes)
