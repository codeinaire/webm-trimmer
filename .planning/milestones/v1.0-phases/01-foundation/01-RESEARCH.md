# Phase 1: Foundation - Research

**Researched:** 2026-03-16
**Domain:** ffmpeg.wasm browser setup, Vite + React + TypeScript project scaffolding, container format identification
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- User will provide a real WebP-with-audio file for format validation
- Phase 1 spike must run `ffprobe` on this file to confirm whether it's WebP or WebM
- If the file turns out to be WebM, update PROJECT.md and OUT-01 requirement accordingly
- Local app only — not deployed to any hosting service
- Single-threaded ffmpeg.wasm (`@ffmpeg/core`, not `@ffmpeg/core-mt`) is the correct choice
- No COOP/COEP header concerns since it runs locally

### Claude's Discretion

- Styling approach (Tailwind, CSS modules, or other — whatever fits best)
- Project folder structure and organization
- Exact Vite configuration beyond the mandatory `optimizeDeps.exclude` for ffmpeg.wasm
- Choice of state management library (Zustand recommended by research)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | All processing runs client-side (no server, no uploads) | ffmpeg.wasm single-threaded core runs entirely in the browser via Web Worker — no server required. Confirmed by official ffmpeg.wasm docs. |
| INFRA-02 | App works in modern browsers (Chrome, Firefox, Safari) | Single-threaded `@ffmpeg/core` (no SharedArrayBuffer) is confirmed to work in Chrome 92+, Firefox 79+, Safari 15.2+. WASM is natively supported in all three targets. |
</phase_requirements>

---

## Summary

Phase 1 has two distinct deliverables: (1) run `ffprobe` on the user's real input file to confirm whether it is a WebP or WebM container, documenting the audio codec and container format for all downstream phases; (2) scaffold the Vite + React + TypeScript project with the mandatory `optimizeDeps.exclude` config and verify that `ffmpeg.wasm` loads and executes a basic command in the browser.

The format validation is the highest-risk item in the entire project. Standard WebP has no audio chunk specification in its RIFF container. The input files are almost certainly WebM containers with a `.webp` extension — but this must be confirmed before writing any trim code, because the container format determines the ffmpeg command flags, output MIME type, and file extension used in every subsequent phase. This is a one-day spike that prevents a full project restart.

The scaffolding work is straightforward and fully documented. The mandatory Vite config (`optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']`) is required to prevent ffmpeg.wasm's internal dynamic `import()` calls from breaking under Vite's pre-bundler. Because the app is local-only and uses the single-threaded core, COOP/COEP header requirements do not apply in production — only the dev server needs them for WASM to initialize correctly.

**Primary recommendation:** Run `ffprobe` on the real input file first. Use its container/codec output to fill in the format decision in PROJECT.md, then scaffold the Vite project. Phase 1 is complete when both deliverables are verified and the format decision is recorded.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.x | UI framework | Concurrent rendering prevents jank during WASM operations. Component model maps to the app's panel layout. |
| TypeScript | 5.9.x | Type safety | Catches ArrayBuffer / Float32Array mismatches at compile time — critical for byte-level media work. |
| Vite | 8.x | Build tool | Native WASM support; required `optimizeDeps.exclude` mechanism; fast HMR. Vite 8 uses Rolldown (faster builds). |
| `@ffmpeg/ffmpeg` | 0.12.15 | ffmpeg.wasm JS API | Only viable client-side media processing solution in browsers. |
| `@ffmpeg/core` | 0.12.10 | Single-threaded WASM binary | No SharedArrayBuffer required; no COOP/COEP headers on production host. Works on all modern browsers and any static host. |
| `@ffmpeg/util` | 0.12.10 | Helpers (`fetchFile`, `toBlobURL`) | Required companion to `@ffmpeg/ffmpeg` for writing files into the WASM VFS. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | latest 4.x | Trim state store | Single source of truth for trimStart / trimEnd prevents bidirectional sync bugs. Needed in Phase 2 scaffold. |
| wavesurfer.js | 7.12.x | Waveform + drag handles | Used in Phase 2 — not needed in Phase 1, but install now to avoid version drift. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ffmpeg/core` (single-thread) | `@ffmpeg/core-mt` (multi-thread) | Multi-thread is ~3x faster but requires SharedArrayBuffer + COOP/COEP headers. Not needed for audio-only trimming on a local app. |
| React 19 | Vanilla JS | Viable at this scope. Choose vanilla only if framework overhead is a concern. Research recommends React given the team is React-native and the UI has several synchronized components. |

**Installation:**
```bash
# Scaffold project
npm create vite@latest webp-trimmer -- --template react-ts
cd webp-trimmer

# ffmpeg.wasm — all three packages must stay at compatible minor versions
npm install @ffmpeg/ffmpeg@0.12.15 @ffmpeg/core@0.12.10 @ffmpeg/util@0.12.10

# Waveform (install now; used in Phase 2)
npm install wavesurfer.js@7.12.3

# State management (install now; used in Phase 2)
npm install zustand

# Dev dependencies
npm install -D typescript@5.9 @types/react@19 @types/react-dom@19 vitest
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/          # UI components
│   └── (empty in Phase 1 — scaffold only)
├── services/
│   └── ffmpeg.ts        # FFmpeg.wasm singleton: load(), trim()
├── store/
│   └── trimStore.ts     # Zustand store (scaffold shape in Phase 1)
├── utils/
│   └── (empty in Phase 1)
└── main.tsx             # App entry
```

Phase 1 only needs `services/ffmpeg.ts` to exist and be verified working. The rest of the structure is scaffolded empty so Phase 2 has a stable import tree to build into.

### Pattern 1: Mandatory Vite Configuration

**What:** `optimizeDeps.exclude` prevents Vite's pre-bundler (esbuild) from processing ffmpeg.wasm's internal dynamic imports. Without it, Vite breaks the WASM module at build time with a hard-to-diagnose runtime error.

**When to use:** Always, for any project using `@ffmpeg/ffmpeg`.

```typescript
// vite.config.ts
// Source: https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/vue-vite-app/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      // Required even for single-thread build in dev mode
      // (Vite dev server needs COOP/COEP to serve WASM correctly)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
})
```

Note: COOP/COEP headers are needed in the **dev server** for WASM initialization even when using single-threaded `@ffmpeg/core`. They are NOT needed on the production static host when using single-thread. This is a common point of confusion.

### Pattern 2: FFmpeg Singleton with ensureLoaded Guard

**What:** One FFmpeg instance lives for the entire app lifetime. Calling `ensureLoaded()` before any operation is idempotent — the WASM binary only downloads once.

**When to use:** Any component or service that needs to run FFmpeg commands.

```typescript
// services/ffmpeg.ts
// Source: https://ffmpegwasm.netlify.app/docs/overview/
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

export async function ensureLoaded(): Promise<void> {
  if (ffmpeg.loaded) return

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
}

export { ffmpeg, fetchFile }
```

For Phase 1 verification, a basic smoke test suffices:

```typescript
// Phase 1 smoke test — verify ffmpeg.wasm loads and runs a command
async function smokeTest(): Promise<void> {
  await ensureLoaded()
  // Run a no-op command to confirm WASM executes
  await ffmpeg.exec(['-version'])
  console.log('ffmpeg.wasm loaded and executing correctly')
}
```

### Pattern 3: Format Identification with ffprobe

**What:** The input file's container format (WebP vs WebM) and audio codec (Opus vs Vorbis) must be confirmed before any trim code is written. Use the native `ffprobe` CLI tool on the real sample file.

**When to use:** Phase 1 spike, before any implementation.

```bash
# Confirm container format and streams
ffprobe -v error -show_format -show_streams -print_format json sample.webp

# Quick magic-byte check (RIFF/WEBP vs EBML/WebM header)
xxd sample.webp | head -4
```

Expected output interpretation:

| `format_name` value | Meaning | Action |
|---------------------|---------|--------|
| `webm` or `matroska,webm` | File is a WebM container with `.webp` extension | Update PROJECT.md and OUT-01 to use `.webm` output |
| `webp` | File is a genuine WebP container | Determine if FFmpeg sees audio streams — likely it won't, flag immediately |
| `riff` (with audio streams) | Non-standard RIFF container with audio | Spike required — see Pitfall 1 below |

Also check the `codec_name` field in the audio stream for Opus vs Vorbis — this determines the `-c:a` flag used in Phase 4 trim operations.

### Anti-Patterns to Avoid

- **Using `createFFmpeg()`:** This is the v0.11 API. It throws at runtime with no clear error when used with v0.12 packages. Always use `new FFmpeg()` + `ffmpeg.load({ coreURL, wasmURL })`.
- **Loading WASM at component mount / page load:** The WASM binary is ~5-30MB. Load it lazily on first user interaction (file pick), not at app startup. Phase 1 spike can load eagerly for testing, but production code must lazy-load.
- **Omitting `optimizeDeps.exclude`:** The error this produces (`Cannot read properties of undefined`) points nowhere useful. It is the most common ffmpeg.wasm setup failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-browser media processing | Custom WASM codec | `@ffmpeg/ffmpeg` + `@ffmpeg/core` | Codec correctness is extraordinarily complex. ffmpeg.wasm wraps the battle-tested FFmpeg binary. |
| Waveform rendering with drag handles | Canvas-based peak renderer + drag logic | wavesurfer.js v7 + Regions plugin | Regions plugin alone replaces ~200 lines of correct drag-handle code with edge-case handling (pixel snapping, out-of-bounds clamping, touch events). |
| WASM file I/O | Custom ArrayBuffer pipe into WASM | `@ffmpeg/util` `fetchFile` / `toBlobURL` | VFS write patterns, memory alignment, and CDN URL handling are documented in the util package. |
| Container format detection | Parsing RIFF / EBML headers in JS | `ffprobe` CLI (Phase 1 spike) | `ffprobe` has codec-specific demuxer logic that catches edge cases raw header inspection misses. |

**Key insight:** ffmpeg.wasm surfaces the full FFmpeg command set in the browser. Every problem that FFmpeg solves on the server (demux, mux, codec negotiation, seek accuracy) is available client-side. Never write custom media processing logic when an FFmpeg flag exists.

---

## Common Pitfalls

### Pitfall 1: WebP Does Not Support Audio — Format Assumption Is Likely Wrong

**What goes wrong:** The project assumes "WebP with audio" is a valid container variant. Standard WebP (RFC 9649, Google's RIFF-based image format) has no audio chunk type. Files with `.webp` extensions that contain audio are almost certainly WebM containers (Google's audio/video container) or a non-standard RIFF extension. Building any trim logic before confirming the actual format risks implementing against the wrong container spec.

**Why it happens:** WebP and WebM share Google/VP8 lineage and similar naming. Community references frequently conflate them.

**How to avoid:** Run `ffprobe` on the real input file. Interpret `format_name` from the JSON output. If it is `webm`, update PROJECT.md and OUT-01 before writing any code.

**Warning signs:** Cannot find documentation of WebP audio chunk spec; `ffprobe` shows `webm` or `matroska` container; Google's WebP Container Spec mentions no audio chunk type.

### Pitfall 2: COOP/COEP Headers Missing in Dev Server

**What goes wrong:** Without `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on the **dev server**, ffmpeg.wasm fails to initialize even with the single-threaded core. The error manifests as `SharedArrayBuffer is not defined` or silent WASM loading failure.

**Why it happens:** The dev server must serve WASM with cross-origin isolation. These headers are only needed on the Vite dev server, not on the production static host (when using single-threaded core).

**How to avoid:** Always include `server.headers` in `vite.config.ts` (see Pattern 1 above). Production builds served from a local file picker or static host without these headers will work fine with `@ffmpeg/core` (not `-mt`).

**Warning signs:** ffmpeg.wasm fails to load only in the browser during dev; `SharedArrayBuffer is not defined` in console; works from CDN examples but not from local Vite dev server.

### Pitfall 3: Version Mismatch Between ffmpeg Packages

**What goes wrong:** `@ffmpeg/ffmpeg`, `@ffmpeg/core`, and `@ffmpeg/util` must be on compatible minor versions. Mixing e.g. `@ffmpeg/ffmpeg@0.12.15` with `@ffmpeg/core@0.12.6` produces cryptic WASM initialization errors.

**Why it happens:** npm installs latest within the range; if only one package is updated, the others fall behind.

**How to avoid:** Pin all three packages to exact versions (`0.12.15`, `0.12.10`, `0.12.10` respectively). The STACK.md version compatibility table documents the tested pairing.

**Warning signs:** WASM loads but `ffmpeg.exec()` throws with no meaningful error; inconsistent behavior across environments; package.json shows different minor versions across the three packages.

### Pitfall 4: Treating ffprobe Spike as Optional

**What goes wrong:** Phase 1 is skipped or treated as a formality, and Phase 2+ implementation proceeds assuming WebP output. When a real file is tested later and turns out to be WebM, the output extension, MIME type, and ffmpeg command flags must be changed throughout the codebase.

**Why it happens:** Format validation feels like a "double-check" rather than a technical decision gate.

**How to avoid:** Phase 1 is not complete until `ffprobe` has been run on the user-provided file and its output has been recorded in PROJECT.md. The success criteria explicitly require this.

**Warning signs:** Phase 1 marked done without any ffprobe output documented; PROJECT.md Key Decisions table still shows "Pending" for the format decision.

---

## Code Examples

Verified patterns from official sources:

### Verify WASM Loads and Executes (Phase 1 Smoke Test)

```typescript
// Source: https://ffmpegwasm.netlify.app/docs/overview/
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

async function verifyFfmpegWasm(): Promise<void> {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'

  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message)
  })

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  // Smoke test: exec returns 0 on success
  const result = await ffmpeg.exec(['-version'])
  console.log('Exit code:', result) // 0 = success
}
```

### ffprobe Commands for Format Validation

```bash
# Full format and stream JSON — paste output into PROJECT.md
ffprobe -v error -show_format -show_streams -print_format json input.webp

# Targeted: just container format name
ffprobe -v error -show_entries format=format_name -print_format default=noprint_wrappers=1 input.webp

# Targeted: audio codec
ffprobe -v error -show_entries stream=codec_name,codec_type -print_format default=noprint_wrappers=1 input.webp

# Magic bytes — first 12 bytes reveal RIFF/WEBP vs EBML (WebM) header
xxd input.webp | head -2
# RIFF container:  52 49 46 46 ... 57 45 42 50  (ASCII: RIFF....WEBP)
# WebM container:  1a 45 df a3 ...              (EBML header)
```

### Minimal vite.config.ts (Phase 1)

```typescript
// Source: https://github.com/ffmpegwasm/ffmpeg.wasm (official example apps)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createFFmpeg()` (v0.11 API) | `new FFmpeg()` + `ffmpeg.load({ coreURL, wasmURL })` | v0.12.0 release | Old API is incompatible with current packages; many blog posts still show the old API |
| Bundled WASM in JS build | CDN-fetched WASM binary at runtime via `toBlobURL` | v0.12.x | Keeps the JS bundle small; WASM binary cached separately by the browser |
| Vite 5/6 with webpack-style WASM | Vite 8 native WASM + Rolldown bundler | Vite 8 (2025) | 10-30x faster builds; first-class WASM support without plugins |
| `@ffmpeg/core-mt` as default | `@ffmpeg/core` (single-thread) as default | Deployment issues surfaced 2023–2025 | Single-thread avoids the SharedArrayBuffer/header deployment trap for all static hosts |

**Deprecated/outdated:**
- `createFFmpeg()`: v0.11 API — throws at runtime with v0.12 packages, no useful error message
- Inlining WASM binary in build output: causes bundle sizes >20MB; replaced by CDN + `toBlobURL` pattern

---

## Open Questions

1. **What is the actual container format of the user's input file?**
   - What we know: Standard WebP has no audio spec; files are likely WebM containers with `.webp` extension
   - What's unclear: Confirmed container format, audio codec (Opus vs Vorbis), whether `AudioContext.decodeAudioData` can decode the file natively
   - Recommendation: Run `ffprobe` on the user-provided file as the first task in Phase 1. Record output in PROJECT.md. If WebM: update OUT-01 and PROJECT.md Key Decisions.

2. **Does `AudioContext.decodeAudioData` handle the input file natively?**
   - What we know: Web Audio API natively decodes WebM/Opus and WebM/Vorbis in all modern browsers
   - What's unclear: Whether the browser can decode the file without FFmpeg preprocessing (depends on format confirmation)
   - Recommendation: Test in Phase 1 alongside the ffprobe spike. If `decodeAudioData` succeeds, the waveform decode path in Phase 2 is confirmed. If it fails, the two-decode strategy needs an FFmpeg preprocessing step for waveform data too.

3. **Which CDN should serve the `@ffmpeg/core` WASM binary?**
   - What we know: `unpkg.com/@ffmpeg/core@0.12.10/dist/umd` is the documented example endpoint
   - What's unclear: Whether `unpkg` reliability is acceptable for a local tool; `jsdelivr` is a common alternative
   - Recommendation: Use `unpkg` for Phase 1 (matches official docs). For Phase 2+, consider hosting the WASM binary locally in `public/` to remove the CDN dependency for a local-only tool.

---

## Sources

### Primary (HIGH confidence)
- [ffmpeg.wasm official docs — Overview](https://ffmpegwasm.netlify.app/docs/overview/) — load API, VFS API, version compatibility
- [ffmpegwasm/ffmpeg.wasm GitHub releases](https://github.com/ffmpegwasm/ffmpeg.wasm/releases) — v0.12.15 + core 0.12.10 confirmed current
- [ffmpegwasm/ffmpeg.wasm official Vite example config](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/vue-vite-app/vite.config.ts) — `optimizeDeps.exclude` pattern confirmed
- [WebP Container Specification — Google for Developers](https://developers.google.com/speed/webp/docs/riff_container) — no audio chunks defined; image-only format
- [RFC 9649 — WebP Image Format (IETF)](https://datatracker.ietf.org/doc/rfc9649/) — confirms image-only standard
- [Vite 8 — Getting Started](https://vite.dev/guide/) — `npm create vite@latest` scaffold command confirmed
- [Vite — Dep Optimization Options](https://vite.dev/config/dep-optimization-options) — `optimizeDeps.exclude` semantics confirmed
- [ffprobe Documentation](https://ffmpeg.org/ffprobe.html) — `-show_format`, `-show_streams`, `-print_format json` flags
- [Pre-existing STACK.md research](/.planning/research/STACK.md) — version compatibility table, full alternatives analysis
- [Pre-existing ARCHITECTURE.md research](/.planning/research/ARCHITECTURE.md) — component boundaries, data flow, build order
- [Pre-existing PITFALLS.md research](/.planning/research/PITFALLS.md) — pitfall catalog with prevention strategies

### Secondary (MEDIUM confidence)
- [FFmpeg.wasm React Setup 2025 — debugplay.com](https://debugplay.com/posts/ffmpeg-react-setup/) — COOP/COEP config, `optimizeDeps.exclude` pattern; verified against official Vite docs
- [ffmpeg.wasm DeepWiki architecture](https://deepwiki.com/ffmpegwasm/ffmpeg.wasm) — Worker isolation and architecture details

### Tertiary (LOW confidence)
- [MDN — WebP and WebM format distinction](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers) — confirming WebM is the audio/video container, WebP is image-only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from official GitHub releases; Vite config verified from official ffmpeg.wasm example app
- Architecture: HIGH — patterns are from official ffmpeg.wasm docs and pre-existing ARCHITECTURE.md research
- Pitfalls: HIGH — format ambiguity pitfall has 3+ independent authoritative sources; COOP/COEP pitfall is from official docs and multiple GitHub issues
- Format validation procedure: HIGH — `ffprobe` commands are standard FFmpeg CLI, documented at ffmpeg.org

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable ecosystem — ffmpeg.wasm releases infrequently; Vite 8 is current stable)
