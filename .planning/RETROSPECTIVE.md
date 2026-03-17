# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-17
**Phases:** 4 | **Plans:** 8 | **Sessions:** ~4

### What Was Built
- Client-side WebM audio trimmer with waveform visualization
- Drag handles + numeric inputs for precise trim control with bidirectional sync
- ffmpeg.wasm-based trim execution with stream copy and WORKERFS mount
- Download flow with before/after size comparison, supporting files up to 130MB

### What Worked
- Two-decode strategy: Web Audio API for fast waveform display, ffmpeg.wasm only at trim time — kept the UI snappy
- Zustand as single source of truth eliminated bidirectional sync bugs between handles and inputs
- Wave-based plan execution with data layer first (Plan 01), then UI (Plan 02) — clean separation
- Format validation spike in Phase 1 caught the WebM-not-WebP reality early, avoiding rework

### What Was Inefficient
- ffmpeg.wasm loading required 3 debugging iterations (CDN blocked by COEP → local UMD files → local ESM files) — could have been caught by research
- Original `-c:a libopus` re-encode decision caused WASM memory crash on large files — discovered only during user testing at 117MB
- wavesurfer.js exports map bug (regions.esm.js didn't exist) required a Vite alias workaround

### Patterns Established
- `vi.hoisted()` for vitest mock factories that reference variables
- WASM VFS cleanup in `finally` blocks with `.catch(() => {})` swallowing delete errors
- ESM build of @ffmpeg/core in `public/` with `toBlobURL` for COEP-safe loading
- WORKERFS mount for zero-copy large file access in ffmpeg.wasm

### Key Lessons
1. Always use ESM builds for WASM modules loaded via dynamic `import()` — UMD silently fails
2. Stream copy (`-c copy`) is strongly preferred over re-encode for audio trimming — Opus packets are all keyframes, so precision loss is negligible (~20ms), and memory usage drops dramatically
3. Test with large files early — the 50MB limit was arbitrary and the 117MB crash revealed a fundamental architecture issue
4. COEP `require-corp` blocks all cross-origin fetches including CDN — must serve WASM files locally

### Cost Observations
- Model mix: ~60% sonnet (executor), ~40% opus (planner/orchestrator)
- Sessions: ~4
- Notable: Phase 1-3 executed smoothly; Phase 4 required post-execution debugging for ffmpeg loading and large file support

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~4 | 4 | Initial project — established patterns for WASM, state management, testing |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 19 | Core paths | 0 (wavesurfer.js, ffmpeg.wasm, zustand all needed) |

### Top Lessons (Verified Across Milestones)

1. Test with realistic file sizes early — don't assume small test files represent production usage
2. Research WASM module formats (ESM vs UMD) before committing to a loading strategy
