# Project Research Summary

**Project:** webp-trimmer
**Domain:** Browser-based client-side audio trimmer (WebP/WebM container format)
**Researched:** 2026-03-16
**Confidence:** MEDIUM

## Executive Summary

This project is a fully client-side audio trimmer targeting files with a `.webp` extension that reportedly contain audio. Research has surfaced a critical format ambiguity that must be resolved before any implementation begins: standard WebP is an image-only format with no audio chunk specification. The files are almost certainly WebM containers (or RIFF containers with non-standard audio extensions) that have been mislabeled with a `.webp` extension. The recommended first action is to run `ffprobe` on real sample files before committing to any implementation. The stack decisions below are valid for either scenario, since ffmpeg.wasm handles both container types.

Given that format ambiguity, the recommended approach is a React 19 + TypeScript + Vite 8 SPA using ffmpeg.wasm (single-threaded `@ffmpeg/core`) for in-browser audio processing and wavesurfer.js v7 with its Regions plugin for waveform display and drag-handle trim interaction. The entire processing pipeline runs client-side with no server dependency, which is the product's core privacy differentiator. The architecture follows a two-decode strategy: one decode via Web Audio API for waveform rendering, and one via ffmpeg.wasm for the actual trim operation. A central Zustand store owns all trim state, preventing the bidirectional sync bugs common in waveform-editor tools.

The primary risks are format misidentification (potentially requiring a full output-format requirement change), silent deployment failures from missing COOP/COEP headers if the multi-threaded ffmpeg.wasm build is chosen, and WASM memory leaks from unreleased ffmpeg VFS entries and Blob URLs. All three risks are preventable with specific phase-level decisions: confirm the actual file format in a spike before building, use the single-threaded WASM build by default, and treat cleanup calls as required parts of the trim function rather than post-launch polish.

## Key Findings

### Recommended Stack

The full stack is React 19 / TypeScript 5.9 / Vite 8 with ffmpeg.wasm (`@ffmpeg/ffmpeg@0.12.15` + `@ffmpeg/core@0.12.10`) as the processing engine and wavesurfer.js 7.12 for waveform visualization. Vite 8 is required (not optional) because it provides native WASM support and the `optimizeDeps.exclude` mechanism that prevents ffmpeg.wasm's dynamic imports from breaking at build time. The single-threaded core is the correct default — it avoids the SharedArrayBuffer/COOP/COEP header requirement that blocks deployment on most static hosts.

See `.planning/research/STACK.md` for version compatibility table, mandatory Vite config, and full alternatives analysis.

**Core technologies:**
- React 19.2: UI framework — concurrent rendering prevents jank during WASM operations
- TypeScript 5.9: type safety — catches ArrayBuffer/Float32Array mismatches at compile time
- Vite 8: build tool — native WASM support, required `optimizeDeps.exclude` config, fast HMR
- ffmpeg.wasm 0.12.15 + @ffmpeg/core 0.12.10: audio processing — only viable client-side media processing solution
- wavesurfer.js 7.12: waveform rendering — Regions plugin provides drag handles out of the box
- Web Audio API (native): waveform decode — `decodeAudioData` converts audio to PCM for visualization

### Expected Features

All P1 features are achievable with the recommended stack. The must-have set is clear and well-bounded for an MVP. Key differentiators (client-side processing, WebP-in/WebP-out, file size feedback) are unique compared to server-side competitors like mp3cut.net.

See `.planning/research/FEATURES.md` for full prioritization matrix and competitor analysis.

**Must have (table stakes):**
- File load via picker and drag-and-drop — entry point; without this nothing works
- Waveform visualization — absence signals a broken or untrustworthy tool
- Draggable start/end trim handles — primary interaction model all users expect
- Numeric inputs for trim points — precision control; bidirectionally synced with handles
- Playback preview of trimmed region — users must hear the result before saving
- Download trimmed file — the actual output; without this the tool is a toy
- File size before/after display — low cost, high perceived value
- Progress indicator during WASM load and trim — prevents "page is broken" perception
- Error feedback for unsupported files — prevents silent WASM crashes

**Should have (competitive):**
- Real-time estimated output size as handles drag — nice UX improvement, trivial to implement
- Keyboard nudge for trim handles — precision without numeric inputs
- Instant waveform feedback on load — makes the tool feel fast

**Defer (v2+):**
- Fade in/out effects — requires re-encode pass; adds complexity before core is proven
- Mobile touch interaction — different UX model; desktop is primary target per PROJECT.md
- Batch trimming — high complexity, single-file UX should be validated first

### Architecture Approach

The architecture is a single-page React application with a central Zustand store as the single source of truth for all trim state. Processing runs in two independent pipelines: Web Audio API decodes the original file immediately on load for waveform display; ffmpeg.wasm runs in a Web Worker only when the user triggers a trim. These pipelines must never be coupled — the waveform should appear instantly without waiting for ffmpeg.wasm to initialize. WaveSurfer is write-only for state purposes; region events push to the store, and all other components read from the store.

See `.planning/research/ARCHITECTURE.md` for full component diagram, data flow sequences, and build order.

**Major components:**
1. FileLoader — accepts file via picker/drag-drop, writes File to store
2. audioDecoder service — wraps `AudioContext.decodeAudioData`, returns AudioBuffer for waveform
3. WaveformView — mounts WaveSurfer.js, syncs region events to store trimStart/trimEnd
4. TrimControls — controlled numeric inputs bound to store; bidirectional with waveform handles
5. PlaybackBar — plays trimmed region using pre-decoded AudioBuffer; no FFmpeg needed
6. ffmpeg service — singleton; `ensureLoaded` guard; `writeFile / exec / readFile / deleteFile` pattern
7. OutputPanel — displays original size, output size, download trigger

### Critical Pitfalls

1. **WebP does not support audio** — Validate real input files with `ffprobe` before writing any code. If they are WebM containers, update the output format requirement. This is the single most likely cause of a full project restart and must be resolved in Phase 1.

2. **SharedArrayBuffer/COOP+COEP headers block deployment** — Use `@ffmpeg/core` (single-threaded) as the default. It requires no special headers, deploys to any static host, and is fast enough for audio-only trimming. Do not use `@ffmpeg/core-mt` unless the production host guarantees header configuration.

3. **WASM cold load perceived as broken** — Show a loading spinner with "Loading audio processor..." immediately. Treat loading UX as a required part of WASM initialization, not a polish step. Test on a throttled connection.

4. **Memory leaks from unreleased FFmpeg VFS and Blob URLs** — Call `ffmpeg.deleteFile()` for both input and output after every trim. Call `URL.revokeObjectURL()` after download. These are required correctness items in the trim function, not cleanup afterthoughts.

5. **Trim inaccuracy with stream copy** — Use re-encode (`-c:a libopus`) rather than `-c copy` for sample-accurate cuts. Stream copy can only cut at keyframe boundaries, producing off-by-a-frame results that users will notice and report.

## Implications for Roadmap

Based on research, the dependency graph mandates this phase order: format validation spike before anything else, then foundational services (WASM + audio decode), then waveform + UI layer, then trim + download, then hardening.

### Phase 1: Format Validation Spike

**Rationale:** The WebP-has-audio assumption is the single most likely project-killing risk. Zero code should be written until real input files are confirmed. The rest of the roadmap depends on knowing whether the output format is `.webp` or `.webm`. This phase costs one day and potentially saves the entire project from a restart.
**Delivers:** Confirmed input/output container format; ffmpeg.wasm environment verified; COOP/COEP deployment decision made.
**Addresses:** Format misidentification pitfall; COOP/COEP header pitfall; WASM load UX pitfall (baseline established).
**Avoids:** Building against a wrong format assumption; choosing wrong WASM core variant.
**Research flag:** Needs format-specific investigation — inspect real files with `ffprobe` and document findings.

### Phase 2: Project Scaffold and WASM Service

**Rationale:** Architecture research specifies a strict build order: Zustand store and ffmpeg service must exist before any UI components. Vite config is mandatory and non-trivial (`optimizeDeps.exclude`, COOP/COEP headers). This phase establishes the foundation everything else builds on.
**Delivers:** Working Vite + React + TypeScript project; ffmpeg singleton service with `ensureLoaded` guard and cleanup pattern; loading indicator; Zustand store with full state shape.
**Uses:** React 19, TypeScript 5.9, Vite 8, @ffmpeg/ffmpeg + @ffmpeg/core, @ffmpeg/util.
**Implements:** FFmpeg.wasm Service and central Zustand store from architecture diagram.
**Research flag:** Standard patterns — skip research-phase. Vite config and ffmpeg init are fully documented.

### Phase 3: Audio Decode and Waveform Visualization

**Rationale:** Waveform rendering is the core UX and the feature users most associate with "this tool works." It also has the most well-known failure mode: browser crash on large files. The audioDecoder service must be built before WaveformView can mount.
**Delivers:** File load (picker + drag-drop), waveform rendering via wavesurfer.js, draggable trim region handles synced to store.
**Uses:** wavesurfer.js 7.12 Regions plugin, Web Audio API decodeAudioData, FileLoader component.
**Implements:** audioDecoder service, FileLoader, WaveformView components; Two-Decode Pattern and Region-State Sync Pattern.
**Avoids:** Waveform crash on large files (add 50MB guard + downsample); WaveSurfer as state owner anti-pattern (push to store, not read from instance).
**Research flag:** Standard patterns — skip research-phase. wavesurfer.js v7 Regions pattern is well-documented.

### Phase 4: Trim Controls and Playback Preview

**Rationale:** Numeric inputs and playback preview depend on waveform state existing in the store. They are independently testable once Phase 3 delivers trimStart/trimEnd state.
**Delivers:** Numeric start/end inputs (seconds-to-cut framing); bidirectional sync with waveform handles; play-trimmed-region preview using pre-decoded AudioBuffer (no FFmpeg needed).
**Implements:** TrimControls component, PlaybackBar component.
**Avoids:** Bidirectional sync bugs — all reads come from the store; inputs and handles write to the same keys.
**Research flag:** Standard patterns — skip research-phase.

### Phase 5: Trim Execution and Download

**Rationale:** The ffmpeg trim command and download output depend on Phase 3 and 4 state. This is the highest-value and highest-risk phase — ffmpeg.wasm memory management and trim accuracy must be explicitly addressed here.
**Delivers:** Trim execution via ffmpeg.wasm with re-encode for sample accuracy; output Blob to store; file size before/after display; download trigger; progress indicator during trim.
**Uses:** ffmpeg.wasm exec with `-c:a libopus` (not `-c copy`), `ffmpeg.deleteFile` cleanup, `URL.createObjectURL / revokeObjectURL`.
**Implements:** OutputPanel, Download trigger; completes end-to-end trim flow.
**Avoids:** Stream-copy inaccuracy (use re-encode); memory leak (deleteFile after every operation); multiple concurrent trims (disable button during processing).
**Research flag:** May need research-phase for exact ffmpeg command flags specific to confirmed container format (depends on Phase 1 findings).

### Phase 6: Hardening and Edge Cases

**Rationale:** Several pitfalls are only catchable through explicit testing: Safari Blob download bugs, invalid file error states, memory behavior over 10+ operations. These should be addressed as a dedicated phase rather than left to "whenever."
**Delivers:** Friendly error messages for invalid/unsupported files; Safari download compatibility; MIME + magic-byte file validation; memory profiling validation; "Looks Done But Isn't" checklist from PITFALLS.md completed.
**Avoids:** Silent WASM crashes on non-audio files; Safari-specific download failures; accumulated memory growth.
**Research flag:** Standard testing patterns — skip research-phase.

### Phase Ordering Rationale

- Phase 1 must precede everything because the output format requirement is unconfirmed and affects ffmpeg command design, MIME types, and file extension handling throughout the codebase.
- Phases 2-3 follow architecture's required build order: store and services before components.
- Phase 4 depends on Phase 3 because trim state lives in the store populated by waveform events.
- Phase 5 depends on Phase 4 because trim execution reads trimStart/trimEnd from the store.
- Phase 6 is last by design — hardening requires a working product to harden.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Format validation is exploratory — outcome determines ffmpeg command design and output MIME type for all subsequent phases.
- **Phase 5:** Exact ffmpeg command for the confirmed container format may need verification, especially if files are non-standard RIFF/WebP rather than WebM.

Phases with standard patterns (skip research-phase):
- **Phase 2:** ffmpeg.wasm scaffold — official docs are authoritative and complete.
- **Phase 3:** wavesurfer.js v7 Regions — documented pattern, high-confidence source.
- **Phase 4:** Trim controls and preview — standard React controlled-input + Web Audio API patterns.
- **Phase 6:** Testing and hardening — checklist-driven, no domain-specific research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Technology choices are HIGH confidence; version pinning is HIGH confidence. Overall MEDIUM because format ambiguity means the exact ffmpeg command and output MIME type remain unconfirmed until Phase 1 spike. |
| Features | MEDIUM | Core trimmer features are HIGH confidence (well-documented via live competitors). WebP-specific audio handling has fewer direct references; depends on Phase 1 format validation. |
| Architecture | HIGH | Official ffmpeg.wasm docs, WaveSurfer.js docs, and MDN are primary sources. Worker-isolation, two-decode, and region-state-sync patterns are verified and well-understood. |
| Pitfalls | HIGH | Multiple authoritative sources including official docs and GitHub issue threads. The format ambiguity pitfall and COOP/COEP pitfall are corroborated by three or more independent sources each. |

**Overall confidence:** MEDIUM — architecture and pitfall knowledge are solid; the format validation gap is the main source of uncertainty and must be resolved before roadmap execution begins.

### Gaps to Address

- **WebP vs WebM format confirmation:** The project cannot proceed past Phase 1 without running `ffprobe` on real input files. If the files are WebM, the output format requirement in PROJECT.md should be updated to `.webm` before any feature work begins.
- **Exact ffmpeg trim command:** The correct codec flag (`-c:a libopus` for Opus, `-c:a libvorbis` for Vorbis) depends on the audio codec in the actual input files. This should be confirmed in Phase 1 alongside container format.
- **Production deployment target:** COOP/COEP header configuration depends on where the app will be hosted. This affects the choice of single-threaded vs multi-threaded ffmpeg.wasm core and should be decided before Phase 2.

## Sources

### Primary (HIGH confidence)
- [WebP Container Specification — Google for Developers](https://developers.google.com/speed/webp/docs/riff_container) — no audio chunks defined
- [RFC 9649 — WebP Image Format (IETF)](https://datatracker.ietf.org/doc/rfc9649/) — image-only format confirmed
- [ffmpeg.wasm official docs](https://ffmpegwasm.netlify.app/docs/overview/) — WASM architecture, VFS API, version compatibility
- [ffmpeg.wasm GitHub releases](https://github.com/ffmpegwasm/ffmpeg.wasm/releases) — v0.12.15 + core 0.12.10 confirmed current
- [wavesurfer.js GitHub](https://github.com/katspaugh/wavesurfer.js) — v7.12.3 current, Regions plugin API
- [wavesurfer.js Regions plugin docs](https://wavesurfer.xyz/plugins/regions) — drag handle pattern confirmed
- [Web Audio API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — decodeAudioData, AudioBufferSourceNode
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) — current stable confirmed
- [React versions](https://react.dev/versions) — 19.2.x current stable confirmed

### Secondary (MEDIUM confidence)
- [ffmpeg.wasm + Vite setup guide — debugplay.com](https://debugplay.com/posts/ffmpeg-react-setup/) — COOP/COEP config, `optimizeDeps.exclude` pattern
- [ffmpeg.wasm DeepWiki architecture](https://deepwiki.com/ffmpegwasm/ffmpeg.wasm) — worker isolation architecture details
- [Riverside.fm: Best Audio Trimmers 2026](https://riverside.com/blog/best-audio-trimmers) — competitor feature survey
- [BBC waveform-data.js](https://github.com/bbc/waveform-data.js) — AudioBuffer to peaks pattern

### Tertiary (LOW confidence)
- [JorenSix/ffmpeg.audio.wasm](https://github.com/JorenSix/ffmpeg.audio.wasm) — audio-focused 5MB WASM build; small fork, maintenance unclear, use only if bundle size is critical

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
