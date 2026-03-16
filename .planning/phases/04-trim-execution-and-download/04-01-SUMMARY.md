---
phase: 04-trim-execution-and-download
plan: 01
subsystem: api
tags: [ffmpeg, wasm, zustand, vitest, typescript]

# Dependency graph
requires:
  - phase: 03-trim-interaction
    provides: trimStart/trimEnd/outputBlob stubs in trimStore; TrimControls component already mounted
  - phase: 01-foundation
    provides: ffmpeg singleton with ensureLoaded(); confirmed codec (libopus) and container (webm)
provides:
  - trimAudio() in ffmpeg.ts with VFS cleanup in finally block
  - Extended trimStore with isProcessing, trimProgress, setOutputBlob, clearOutput
  - setTrimStart/setTrimEnd clear stale outputBlob on call
  - formatBytes utility (KB below 1MB, MB at/above, 1 decimal)
  - 19 unit tests covering all data-layer contracts
affects: [04-02-trim-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() for mocks referenced in vi.mock() factory — vitest hoists vi.mock above const declarations"
    - "finally block for mandatory WASM VFS cleanup: deleteFile with .catch(() => {}) on both input and output"
    - "progressHandler as named variable so same reference passed to ffmpeg.on and ffmpeg.off"

key-files:
  created:
    - src/utils/formatBytes.ts
    - src/utils/formatBytes.test.ts
    - src/store/trimStore.test.ts
    - src/services/ffmpeg.test.ts
  modified:
    - src/store/trimStore.ts
    - src/services/ffmpeg.ts

key-decisions:
  - "vi.hoisted() required to declare mock variables that vi.mock factory can reference — vitest hoists vi.mock calls above variable declarations"
  - "Blob constructor receives data.buffer as ArrayBuffer cast to satisfy TypeScript strict typing on Uint8Array<ArrayBufferLike>"
  - "progressHandler stored as named const so ffmpeg.on and ffmpeg.off receive identical reference — prevents ghost handlers on repeated trims"

patterns-established:
  - "Pattern 1: TDD with vitest — RED (write failing test), GREEN (implement), verify passes"
  - "Pattern 2: Zustand direct state manipulation in tests via useTrimStore.getState() and useTrimStore.setState()"
  - "Pattern 3: WASM VFS cleanup in finally block with .catch(() => {}) swallowing delete errors"

requirements-completed: [OUT-01, OUT-02, OUT-03, OUT-04]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 4 Plan 01: Trim Execution Data Layer Summary

**trimAudio() with VFS cleanup, extended Zustand store with isProcessing/clearOutput, formatBytes utility — all backed by 19 passing vitest unit tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T23:22:50Z
- **Completed:** 2026-03-16T23:25:17Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `trimAudio()` function added to ffmpeg.ts — writes input to VFS, exec with `-c:a libopus -f webm`, reads output, returns `Blob('audio/webm')`, cleans up both VFS entries in `finally` block
- `trimStore` extended with `isProcessing`, `trimProgress`, `setOutputBlob`, `clearOutput`, `setIsProcessing`, `setTrimProgress`; `setTrimStart`/`setTrimEnd` now clear stale `outputBlob` on call; `AppStatus` includes `'trimming'`
- `formatBytes` utility correctly returns KB (below 1 MB) or MB (at/above 1 MB) with 1 decimal place
- 19 unit tests across 3 test files, all green; build passes with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create formatBytes utility with tests** - `c1e7e27` (feat)
2. **Task 2: Extend trimStore and ffmpeg service** - `536ed67` (feat)
3. **Task 3: ffmpeg service unit tests with mocked @ffmpeg/ffmpeg** - `54a50e2` (test)

_Note: Tasks 1 and 3 were TDD — tests written first, then implementation._

## Files Created/Modified
- `src/utils/formatBytes.ts` - File size formatter: KB below 1 MB, MB at/above 1 MB, 1 decimal place
- `src/utils/formatBytes.test.ts` - 8 unit tests covering 0, boundary (1048575/1048576), and common values
- `src/store/trimStore.ts` - Extended with isProcessing, trimProgress, setOutputBlob, clearOutput; setTrimStart/setTrimEnd clear outputBlob; reset resets all new fields
- `src/store/trimStore.test.ts` - 6 unit tests for store extensions using useTrimStore.getState/setState directly
- `src/services/ffmpeg.ts` - Added trimAudio() with finally cleanup, progress handler lifecycle
- `src/services/ffmpeg.test.ts` - 5 unit tests with mocked @ffmpeg/ffmpeg and @ffmpeg/util via vi.hoisted()

## Decisions Made
- Used `vi.hoisted()` to declare mock variables that `vi.mock()` factory references — vitest hoists `vi.mock` calls above `const` declarations, so plain variables aren't accessible in the factory
- Cast `data.buffer as ArrayBuffer` in Blob constructor to satisfy TypeScript strict typing; `ffmpeg.readFile()` returns `Uint8Array<ArrayBufferLike>` which doesn't satisfy `BlobPart` directly
- Stored `progressHandler` as a named `const` so the same reference is used for `ffmpeg.on` and `ffmpeg.off`, preventing stale/ghost progress listeners on repeated trims

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error: Uint8Array<ArrayBufferLike> not assignable to BlobPart**
- **Found during:** Task 2 (extend trimStore and ffmpeg service)
- **Issue:** `new Blob([data], { type: 'audio/webm' })` where `data` is typed as `Uint8Array<ArrayBufferLike>` fails TypeScript strict check — `ArrayBufferLike` includes `SharedArrayBuffer` which is not `BlobPart`
- **Fix:** Changed to `new Blob([data.buffer as ArrayBuffer], ...)` — extracts the underlying ArrayBuffer and casts to satisfy the type constraint
- **Files modified:** src/services/ffmpeg.ts
- **Verification:** `npm run build` exits 0 with no type errors
- **Committed in:** `536ed67` (Task 2 commit)

**2. [Rule 3 - Blocking] Used vi.hoisted() for mock variable declarations in ffmpeg.test.ts**
- **Found during:** Task 3 (ffmpeg service unit tests)
- **Issue:** `vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: vi.fn().mockImplementation(() => ({ load: mockLoad, ... })) }))` — vitest hoists `vi.mock` to top of file before `const mockLoad = vi.fn()`, causing `ReferenceError: Cannot access 'mockLoad' before initialization`
- **Fix:** Replaced `const mockLoad = vi.fn()` pattern with `vi.hoisted(() => ({ mockLoad: vi.fn(), ... }))` — makes variables available in the hoisted scope
- **Files modified:** src/services/ffmpeg.test.ts
- **Verification:** `npx vitest run src/services/ffmpeg.test.ts` exits 0 (5 tests pass)
- **Committed in:** `54a50e2` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep — plan implementation is identical, only TypeScript cast and test infrastructure pattern changed.

## Issues Encountered
- vitest mock hoisting is a well-known gotcha — `vi.hoisted()` is the canonical solution documented in vitest docs

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete data/service contract for Plan 02 (UI): `trimAudio()`, `isProcessing`, `setOutputBlob`, `clearOutput`, `formatBytes` all exist with tested APIs
- Plan 02 can wire `TrimActions` component directly — no guessing about function signatures or store shape
- No blockers

## Self-Check: PASSED

- src/utils/formatBytes.ts: FOUND
- src/utils/formatBytes.test.ts: FOUND
- src/store/trimStore.test.ts: FOUND
- src/services/ffmpeg.test.ts: FOUND
- Commit c1e7e27: FOUND
- Commit 536ed67: FOUND
- Commit 54a50e2: FOUND

---
*Phase: 04-trim-execution-and-download*
*Completed: 2026-03-17*
