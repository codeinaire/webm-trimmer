# Roadmap: WebP Trimmer

**Project:** WebP Trimmer
**Core Value:** Users can quickly trim the duration of a WebP audio file in the browser and save a smaller version without leaving the page or uploading to a server.
**Depth:** Standard
**Created:** 2026-03-16
**Total Phases:** 4
**Requirement Coverage:** 14/14 ✓

---

## Phases

- [x] **Phase 1: Foundation** - Confirm file format, scaffold project, verify WASM runs in-browser (completed 2026-03-16)
- [ ] **Phase 2: File Load and Waveform** - User can load a file and see its audio waveform with format validation
- [ ] **Phase 3: Trim Interaction** - User can set precise trim points via draggable handles and numeric inputs
- [ ] **Phase 4: Trim Execution and Download** - User can trim and download the file with size feedback

---

## Phase Details

### Phase 1: Foundation

**Goal:** The project environment runs client-side with WASM audio processing confirmed working before any feature code is written.
**Depends on:** Nothing
**Requirements:** INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Running `ffprobe` on a real input file confirms whether it is WebP or WebM, and the output format requirement is documented as a result
  2. ffmpeg.wasm loads and executes a basic command in a local browser tab (Chrome, Firefox, Safari) without a server
  3. The Vite + React + TypeScript project builds and serves locally with the mandatory `optimizeDeps.exclude` config in place
  4. The single-threaded WASM core is selected (or multi-threaded justified with documented header plan), and that decision is recorded in PROJECT.md
**Plans:** 2/2 plans complete

Plans:
- [ ] 01-01-PLAN.md — Scaffold Vite + React + TS project with ffmpeg.wasm verified working in browser
- [ ] 01-02-PLAN.md — Format validation spike: ffprobe on real input file, document findings

### Phase 2: File Load and Waveform

**Goal:** Users can load a WebP/WebM audio file and immediately see its waveform; unsupported files show a clear error.
**Depends on:** Phase 1
**Requirements:** LOAD-01, FMT-01, FMT-02, WAVE-01
**Success Criteria** (what must be TRUE):
  1. User clicks "Open file" and selects a supported file; waveform appears without a page reload or server call
  2. User selects a non-audio file (e.g., a JPEG); app shows a legible error message identifying the problem
  3. User selects a file with an unexpected container; app identifies whether it is WebP or WebM and displays that information
  4. Waveform is visible and reflects the audio content of the file (amplitude variation is visible, not a flat line)
**Plans:** TBD

### Phase 3: Trim Interaction

**Goal:** Users can precisely control which portion of audio to keep using both draggable handles and numeric inputs, with all controls staying in sync.
**Depends on:** Phase 2
**Requirements:** WAVE-02, WAVE-03, WAVE-04, WAVE-05
**Success Criteria** (what must be TRUE):
  1. User drags the start handle right; the numeric "cut from start" input updates to match the new position in seconds
  2. User types a value in the "cut from start" input; the start handle moves to the corresponding waveform position
  3. User types a value in the "cut from end" input; the end handle moves and the trimmed region is highlighted correctly
  4. User presses the left or right arrow key while a handle is focused; the handle moves by a small fixed increment and the numeric input updates
  5. Handles and inputs cannot be set to values that would make trim-start exceed trim-end (invalid state is prevented)
**Plans:** TBD

### Phase 4: Trim Execution and Download

**Goal:** Users can execute the trim, see file size before and after, and download the result — all without leaving the page.
**Depends on:** Phase 3
**Requirements:** OUT-01, OUT-02, OUT-03, OUT-04
**Success Criteria** (what must be TRUE):
  1. User clicks "Trim and Download"; a progress indicator appears during processing and the browser downloads the trimmed file when complete
  2. The downloaded file plays correctly in a media player and its duration matches the trimmed region (not the full original)
  3. App displays the original file size and the trimmed file size after processing; both values are accurate
  4. While the user is dragging handles, the estimated output size updates in real time without triggering a trim operation
  5. If trim processing fails (e.g., corrupt file, WASM crash), the user sees an error message and the app remains usable without a page reload
**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-16 |
| 2. File Load and Waveform | 0/? | Not started | - |
| 3. Trim Interaction | 0/? | Not started | - |
| 4. Trim Execution and Download | 0/? | Not started | - |

---

## Requirement Coverage

| Requirement | Phase | Description |
|-------------|-------|-------------|
| INFRA-01 | Phase 1 | All processing runs client-side (no server, no uploads) |
| INFRA-02 | Phase 1 | App works in modern browsers (Chrome, Firefox, Safari) |
| LOAD-01 | Phase 2 | User can load a file via file picker |
| FMT-01 | Phase 2 | App validates input file format (WebP or WebM container) |
| FMT-02 | Phase 2 | App shows clear error message for unsupported file types |
| WAVE-01 | Phase 2 | App displays audio waveform visualization of the loaded file |
| WAVE-02 | Phase 3 | User can drag start/end handles on the waveform to set trim region |
| WAVE-03 | Phase 3 | User can type seconds to cut from start/end via numeric inputs |
| WAVE-04 | Phase 3 | Waveform handles and numeric inputs stay in bidirectional sync |
| WAVE-05 | Phase 3 | User can nudge trim handles with keyboard arrow keys |
| OUT-01 | Phase 4 | User can download the trimmed file as WebP |
| OUT-02 | Phase 4 | App displays file size before and after trimming |
| OUT-03 | Phase 4 | App shows real-time estimated output size as handles are dragged |
| OUT-04 | Phase 4 | App shows progress indicator during WASM load and trim operations |

**Coverage: 14/14 -- no orphaned requirements**

---

*Roadmap created: 2026-03-16*
*Last updated: 2026-03-16 after Phase 1 planning*
