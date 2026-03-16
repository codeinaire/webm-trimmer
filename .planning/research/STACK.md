# Stack Research

**Domain:** Browser-based client-side audio trimmer for WebP files containing audio
**Researched:** 2026-03-16
**Confidence:** MEDIUM (see critical flag below)

---

## CRITICAL FLAG: WebP Does Not Support Audio

**This must be resolved before stack decisions are finalized.**

The official WebP Container Specification (RFC 9649, Google) defines exactly these chunk types: `VP8 `, `VP8L`, `VP8X`, `ALPH`, `ANIM`, `ANMF`, `ICCP`, `EXIF`, `XMP`. No audio chunk exists. FFmpeg also treats WebP as an image-only format and uses `-an` (no audio) as default when outputting to WebP. No browser exposes `canPlayType('image/webp')` as an audio format.

**Two plausible interpretations:**

1. **The files are actually WebM** — WebM (`.webm`) is the web audio/video container format that shares Google/VP8 lineage. WebM fully supports Vorbis and Opus audio. If the user has `.webp` files with audio, they may be mislabeled `.webm` files or the tool that produced them wrote a non-standard RIFF-like container with audio chunks using a `.webp` extension.

2. **The files use a proprietary/non-standard RIFF extension** — RIFF (the base format for WebP) technically allows arbitrary custom chunks. A tool could embed audio in a RIFF container with the `WEBP` FourCC. This is non-standard and no published spec exists for it.

**Recommended action:** Obtain a sample file and inspect its magic bytes and chunk structure before committing to any implementation. Run `xxd file.webp | head -4` to see if `RIFF....WEBP` or `RIFF....WEBM` appears in the header.

**Stack decisions below are valid for either scenario** since ffmpeg.wasm handles both WebP and WebM containers, and the UI layer is format-agnostic.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.x | UI framework | Component model maps naturally to the three-panel layout (file loader / waveform / controls). React 19's concurrent rendering prevents UI jank during WASM operations. State management is local enough that no external state library is needed. |
| TypeScript | 5.9.x | Type safety | File format parsing and AudioBuffer manipulation are byte-level operations where type errors are silent bugs. TypeScript catches mismatched ArrayBuffer/Float32Array operations at compile time. |
| Vite | 8.x | Build tool | Native WASM support, fast HMR, and built-in handling of `?url` imports required by ffmpeg.wasm. Vite 8 uses Rolldown (10-30x faster builds than Webpack). Required for correct COOP/COEP header injection in dev server. |
| ffmpeg.wasm (`@ffmpeg/ffmpeg`) | 0.12.15 | Audio processing and file demux/mux | The only viable client-side solution for demuxing and re-muxing arbitrary media containers in the browser. Exposes the full FFmpeg command set over WASM. For trimming: `ffmpeg -ss [start] -to [end] -i input.webp -c copy output.webp`. |
| Web Audio API | Native browser | Decode audio for waveform rendering | After ffmpeg.wasm extracts audio, `AudioContext.decodeAudioData()` decodes it to PCM `Float32Array` channel data, which wavesurfer.js renders. No extra dependency. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wavesurfer.js | 7.12.x | Waveform rendering and region selection | Renders decoded PCM peaks visually. Use the bundled Regions plugin for draggable trim handles. Load via `wavesurfer.load('', channelData, duration)` — pass empty string as URL and supply decoded channel data directly. This avoids CORS and blob URL issues. |
| `@ffmpeg/core` | 0.12.10 | Single-threaded WASM core binary | Use the single-threaded core (`@ffmpeg/core`, not `@ffmpeg/core-mt`) to avoid mandatory SharedArrayBuffer + COOP/COEP headers in production. SharedArrayBuffer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers on every server that hosts the app — a deployment constraint many static hosts (GitHub Pages, Netlify free tier) cannot satisfy without extra configuration. |
| `@ffmpeg/util` | 0.12.x | Utility helpers | Provides `fetchFile`, `toBlobURL` helpers for loading the WASM binary and writing files into ffmpeg's virtual filesystem. Required alongside `@ffmpeg/ffmpeg`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server with custom headers | COOP/COEP injection during development | Add to `vite.config.ts`: `server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } }`. Required even for single-thread build in dev mode due to how Vite serves WASM. |
| Vitest | Unit testing | Co-located with Vite, same config. Test file parsing logic and trim calculation functions without spinning up a browser. |

---

## Installation

```bash
# Core framework and build tool
npm create vite@latest webp-trimmer -- --template react-ts
cd webp-trimmer

# ffmpeg.wasm: all three packages must be installed together
# version pinning is important — minor versions are not always compatible
npm install @ffmpeg/ffmpeg@0.12.15 @ffmpeg/core@0.12.10 @ffmpeg/util@0.12.10

# Waveform renderer
npm install wavesurfer.js@7.12.3

# Dev dependencies (Vite already included from scaffolding)
npm install -D typescript@5.9 @types/react@19 @types/react-dom@19 vitest
```

---

## Vite Configuration (Required)

The following `vite.config.ts` is mandatory for ffmpeg.wasm to function:

```typescript
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

**Why `optimizeDeps.exclude`:** ffmpeg.wasm uses dynamic `import()` internally; Vite's dependency pre-bundler breaks this. Excluding prevents a hard-to-debug runtime error.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@ffmpeg/core` (single-thread) | `@ffmpeg/core-mt` (multi-thread) | Use multi-thread only if processing files >100MB and the deployment environment guarantees COOP/COEP headers (e.g., controlled corporate intranet). Multi-thread is ~3x faster but requires SharedArrayBuffer. |
| React 19 | Vanilla JS / no framework | Viable for this scope. If the team wants zero framework overhead, the waveform + controls UI can be built with vanilla DOM. Choose React if the team is already React-native or the UI grows beyond the MVP. |
| wavesurfer.js v7 | Web Audio API canvas rendering (custom) | Roll your own only if wavesurfer's ~100KB bundle is unacceptable or if you need pixel-level control over rendering. wavesurfer's Regions plugin saves 200+ lines of drag-handle code. |
| Web Audio API (`decodeAudioData`) | Tone.js | Tone.js is a music scheduling framework, not a decoder. Unnecessary dependency for this use case. |
| Vite 8 | webpack 5 | Use webpack only if the project must integrate into an existing webpack monorepo. Vite 8 is dramatically faster and has first-class WASM support. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@ffmpeg/core-mt` for initial build | Requires SharedArrayBuffer which needs COOP/COEP headers on production host. Most static hosts (GitHub Pages default, Netlify without custom headers) will fail silently. | `@ffmpeg/core` (single-thread). Add `-mt` later when deployment headers are confirmed. |
| `createFFmpeg` (old API) | This is the v0.11.x API. Documentation examples on blogs still use it. It does not work with v0.12.x packages and will throw at runtime with no clear error. | `new FFmpeg()` + `ffmpeg.load({ coreURL, wasmURL })` with `?url` imports. |
| Peaks.js | Only 22 weekly downloads vs 743 for wavesurfer.js. Smaller community, less maintained. BBC's audiowaveform server dependency makes it complex for pure client-side use. | wavesurfer.js v7 |
| Server-side Node.js FFmpeg | Violates the "no server" constraint. | ffmpeg.wasm |
| MediaRecorder API for trimming | MediaRecorder is for recording live streams. It cannot trim an existing file. | ffmpeg.wasm `exec` with `-ss` / `-to` flags |
| Full ffmpeg.wasm bundle without size concern | The complete `@ffmpeg/core` WASM binary is ~20MB uncompressed. Load it lazily (on user file-drop, not on page load). | Lazy-load: call `ffmpeg.load()` inside the file input handler, not at app mount. |

---

## Stack Patterns by Variant

**If the files turn out to be WebM (not WebP):**
- No stack changes needed. ffmpeg.wasm handles WebM natively.
- Change output filename extension from `.webp` to `.webm` in the download step.
- `AudioContext.decodeAudioData()` will decode WebM/Opus or WebM/Vorbis audio natively in all modern browsers.

**If the files are truly non-standard RIFF/WebP with embedded audio:**
- ffmpeg.wasm may not know the codec. You will need to probe with `ffprobe` equivalent: `ffmpeg.exec(['-i', 'input.webp'])` and inspect stderr output for stream detection.
- If the audio codec is unknown to FFmpeg, the only fallback is raw RIFF chunk parsing in JavaScript. This is a significant spike — flag this risk before starting Phase 1.

**If bundle size becomes a constraint (<5MB total):**
- Replace `@ffmpeg/core` with `ffmpeg.audio.wasm` (JorenSix fork) — audio-focused WASM build, ~5MB uncompressed (~3MB gzipped). Supports audio codecs only.
- Tradeoff: not the official package, less maintained, may lag ffmpeg releases.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@ffmpeg/ffmpeg@0.12.15` | `@ffmpeg/core@0.12.10` | Core minor version must match ffmpeg minor version. `0.12.15` ffmpeg + `0.12.10` core is the tested pairing per releases page. |
| `@ffmpeg/ffmpeg@0.12.x` | `@ffmpeg/util@0.12.x` | Keep util minor in sync with ffmpeg. |
| wavesurfer.js@7.x | React@19 | No official React integration package needed. Use as vanilla JS inside a `useEffect` hook with a `ref` to the container div. |
| Vite@8 | `@ffmpeg/ffmpeg@0.12.x` | Requires `optimizeDeps.exclude` for ffmpeg packages (see config above). |
| TypeScript@5.9 | React@19 | Use `@types/react@19`. |

---

## Sources

- [WebP Container Specification — Google for Developers](https://developers.google.com/speed/webp/docs/riff_container) — Verified: no audio chunks defined. HIGH confidence.
- [RFC 9649 — WebP Image Format](https://datatracker.ietf.org/doc/rfc9649/) — Official IETF standard. Confirmed image-only format. HIGH confidence.
- [ffmpegwasm/ffmpeg.wasm releases](https://github.com/ffmpegwasm/ffmpeg.wasm/releases) — v0.12.15 confirmed as latest, core at 0.12.10. HIGH confidence.
- [ffmpeg.wasm installation docs](https://ffmpegwasm.netlify.app/docs/getting-started/installation) — Package names `@ffmpeg/ffmpeg`, `@ffmpeg/util` confirmed. HIGH confidence.
- [How to Set Up FFmpeg in React (Vite, 2025) — Debug & Play](https://debugplay.com/posts/ffmpeg-react-setup/) — COOP/COEP config, `optimizeDeps.exclude`, `?url` import pattern. MEDIUM confidence (community source, verified against official docs).
- [wavesurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) — v7.12.3 as of 2026-03-12. `load('', channelData, duration)` pattern for buffer-based loading. HIGH confidence.
- [wavesurfer.js Regions plugin](https://wavesurfer.xyz/plugins/regions) — Regions plugin confirmed for draggable trim handles. HIGH confidence.
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) — Vite 8 is current stable. HIGH confidence.
- [React versions](https://react.dev/versions) — React 19.2.x confirmed stable. HIGH confidence.
- [TypeScript 5.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) — TypeScript 5.9 is current. HIGH confidence.
- [JorenSix/ffmpeg.audio.wasm](https://github.com/JorenSix/ffmpeg.audio.wasm) — Audio-focused 5MB build alternative. LOW confidence (small fork, maintenance unclear).

---

*Stack research for: browser-based WebP audio trimmer*
*Researched: 2026-03-16*
