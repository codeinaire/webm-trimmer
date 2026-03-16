# Pitfalls Research

**Domain:** Browser-based media processing / WebP audio trimmer
**Researched:** 2026-03-16
**Confidence:** HIGH (multiple authoritative sources, official docs, GitHub issue threads)

---

## Critical Pitfalls

### Pitfall 1: The WebP-Has-Audio Assumption Is Unverified

**What goes wrong:**
The project is built on the premise that "WebP files can contain audio data (similar to WebM containers)." This is almost certainly false. WebP is an image format (RIFF-based, using VP8-encoded image data). WebM is the separate audiovisual container format. The two formats share a name prefix and both descend from the RIFF/Matroska lineage, which creates persistent confusion, but they are not the same thing. Standard WebP has no audio track specification. "WebP with audio" is not a documented or widely supported container variant.

**Why it happens:**
The similarity in naming (WebP vs WebM) and the shared RIFF container heritage makes the formats feel interchangeable. Community discussions frequently conflate the two. The project brief itself appears to have inherited this confusion.

**How to avoid:**
Before any other work, validate that the actual input files are genuinely WebP (not WebM or another format with a .webp extension). Inspect real example files with `ffprobe` to confirm what container and streams are present. If the files are actually WebM containers (audio-only `.weba` or video+audio `.webm` renamed to `.webp`), reconsider whether the output format requirement "must output valid WebP" is meaningful or whether it should be WebM.

**Warning signs:**
- Cannot find any documentation of WebP audio stream specification
- FFmpeg `ffprobe` on sample files shows `webm` or `matroska` container, not `webp`
- The Google WebP Container Specification mentions no audio chunk type

**Phase to address:**
Phase 1 (spike / feasibility) — Prove the input format before building anything else. This is the single most likely cause of a full project restart.

---

### Pitfall 2: SharedArrayBuffer / COOP + COEP Header Requirement Blocks Deployment

**What goes wrong:**
The multi-threaded build of ffmpeg.wasm (`@ffmpeg/core-mt`) requires `SharedArrayBuffer`, which browsers only expose in cross-origin isolated environments. This requires two HTTP response headers to be set on every page:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers cannot be set from client-side JavaScript. They must come from the server (or a service worker). On static hosting (GitHub Pages, Netlify, Vercel free tier) the default configuration does not set these headers. A deployment that omits them will produce a silent runtime failure: `SharedArrayBuffer is not defined`.

**Why it happens:**
Developers test locally with Vite/webpack dev servers (which can set custom headers) and miss that production static hosts need explicit configuration. The error message does not clearly point to the missing headers.

**How to avoid:**
Two options: (a) Use the single-threaded build `@ffmpeg/core` — no SharedArrayBuffer required, no COOP/COEP needed, slightly slower but dramatically simpler to deploy. (b) If using the multi-threaded build, configure COOP/COEP headers in the host's configuration file (`_headers` on Netlify, `vercel.json` on Vercel) and validate before launch. For audio-only trimming (not video re-encoding), the single-threaded build is fast enough and the correct default.

**Warning signs:**
- Works in local dev, silently fails in production
- Browser console shows `SharedArrayBuffer is not defined` or `Cannot read properties of undefined`
- No COOP/COEP headers visible in Network tab response headers on the deployed URL

**Phase to address:**
Phase 1 (environment setup) — Choose the single-threaded build by default, document the header requirement if the multi-threaded build is ever needed.

---

### Pitfall 3: ffmpeg.wasm WASM Core Bundle Is 5-30MB — Perceived as Broken on First Load

**What goes wrong:**
`@ffmpeg/core` downloads ~5MB of WASM on first use. `@ffmpeg/core-mt` can be 20-30MB. Without an explicit loading state and progress indicator, users see a blank or frozen UI for 3-15 seconds (depending on connection speed) and assume the page is broken. The WASM binary is not bundled into the JS build by default — it is fetched from a CDN at runtime.

**Why it happens:**
Developers test on fast localhost connections where the fetch is instantaneous. The loading UX is not a technical requirement, so it gets deferred until "polish" — by which point users have already reported it as broken.

**How to avoid:**
Show a loading state ("Initializing processor...") immediately on page load while the WASM binary downloads. Consider preloading with `<link rel="preload">`. Cache the WASM binary via a Service Worker or rely on browser cache after first load (CDN responses set long cache-control headers). Use the audio-focused minimal FFmpeg build (`ffmpeg.audio.wasm` by JorenSix) if it reduces binary size.

**Warning signs:**
- First-visit experience feels frozen for several seconds
- No loading indicator during WASM initialization
- No progress callback hooked up to ffmpeg's `load()` call

**Phase to address:**
Phase 1 (FFmpeg integration) — Treat loading UX as a required part of the WASM initialization work, not a polish step.

---

### Pitfall 4: Memory Leaks From Unreleased FFmpeg Instances and Blob URLs

**What goes wrong:**
Each invocation of `ffmpeg.writeFile()` / `ffmpeg.readFile()` allocates memory inside the WASM heap. If `ffmpeg.deleteFile()` is not called after each operation and `ffmpeg.terminate()` (or `ffmpeg.exit()`) is not called when done, the WASM heap grows on every trim operation without releasing. Separately, every `URL.createObjectURL()` call for preview playback or download leaks a Blob URL unless `URL.revokeObjectURL()` is explicitly called. On a single-page tool that stays open, these leaks accumulate.

**Why it happens:**
WASM memory is not garbage-collected by the JS engine. Blob URLs are reference-counted outside the GC cycle. Neither is cleaned up automatically. GitHub issues for ffmpeg.wasm (issues #200, #494, #83) document this as a common, well-known problem.

**How to avoid:**
After every trim: call `ffmpeg.deleteFile(inputName)` and `ffmpeg.deleteFile(outputName)` to release WASM virtual filesystem entries. Call `URL.revokeObjectURL(url)` in the cleanup logic after download or preview is dismissed. Keep one FFmpeg instance alive across multiple operations (singleton pattern) rather than creating/destroying per operation. Monitor memory via DevTools Memory tab during development.

**Warning signs:**
- Memory usage in Task Manager grows steadily with each trim
- Browser slows down after 5-10 trim operations in one session
- `ERR_OUT_OF_MEMORY` or `RuntimeError: memory access out of bounds` after repeated use

**Phase to address:**
Phase 2 (trim processing) — Include cleanup calls as part of the trim function, not as a post-launch fix.

---

### Pitfall 5: Trim Inaccuracy When Using Stream Copy (No Re-encode)

**What goes wrong:**
FFmpeg's stream copy mode (`-c copy`) cannot cut at arbitrary timestamps — it can only cut at keyframe boundaries. For audio, keyframes occur every ~20-128ms depending on the codec, so cuts may be off by up to one codec frame. When trimming audio-only content this is usually acceptable, but if the output is expected to start or end at an exact millisecond (e.g., to sync with a visual element), stream copy will not achieve it.

**Why it happens:**
Stream copy is fast and lossless, so it is the natural first choice. The inaccuracy is not obvious until tested with precise measurements.

**How to avoid:**
For audio trimming, use re-encoding (`-c:a libopus` or `-c:a libvorbis` for WebM/WebP output). This decodes the audio and re-encodes it, allowing sample-accurate cuts. The speed penalty is acceptable for audio-only files that are seconds to minutes long in WASM. Document the re-encode approach explicitly so it is not "optimized" back to stream copy later.

**Warning signs:**
- Output audio starts slightly before or after the requested trim point
- Off-by-a-frame at the beginning or end when comparing input vs output
- Using `-c copy` in the FFmpeg command string

**Phase to address:**
Phase 2 (trim processing) — Choose re-encode in the initial FFmpeg command design.

---

### Pitfall 6: Waveform Rendering Blocks or Crashes on Large Audio Files

**What goes wrong:**
`decodeAudioData()` (Web Audio API) loads the entire audio file into memory as a raw PCM buffer before the waveform can be drawn. For large files (>10 minutes, >50MB), this can consume hundreds of megabytes of RAM. Known wavesurfer.js issues document browser crashes and hangs when loading large audio files. Additionally, zooming in on a long audio waveform in wavesurfer can spike memory to 4GB.

**Why it happens:**
Waveform rendering libraries decode the full file to get amplitude data at every sample. For short audio clips (the likely use case here), this is fine — but "WebP audio" files could plausibly be long. The decode happens synchronously in the browser's audio thread if not wrapped in a worker.

**How to avoid:**
Set a reasonable file size warning threshold (e.g., warn at >50MB). Downsample the waveform data after decoding — render at 1 peak per 100-500ms, not per sample. Use wavesurfer.js v7+ which has improved memory management. Call `wavesurfer.destroy()` explicitly before loading a new file to release the previous AudioBuffer. Do not allow zoom levels that trigger the memory spike issue.

**Warning signs:**
- Browser tab crashes or freezes when loading large audio
- RAM usage jumps by hundreds of MB during waveform render
- wavesurfer instance not destroyed before loading new file

**Phase to address:**
Phase 2 (waveform visualization) — Include file size guard and explicit destroy-before-reload pattern.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Load WASM synchronously on page load | Simpler code | Page load blocks; slow initial UX | Never — lazy load always |
| Create a new FFmpeg instance per trim operation | Simpler lifecycle | Memory leak, slow re-initialization | Never — use singleton |
| Skip `URL.revokeObjectURL()` | Simpler code | Blob URL memory leak per trim/preview | Never in a long-running session |
| Use stream copy (`-c copy`) for trim | Faster, lossless | Inaccurate cut points at frame boundaries | Only if millisecond accuracy is unneeded |
| Render full-resolution waveform (per-sample) | Higher visual fidelity | Memory spike on large files, slow render | Never — always downsample |
| Skip COOP/COEP header configuration | Faster deployment setup | ffmpeg.wasm multi-thread silently breaks | Acceptable if single-thread build is used |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ffmpeg.wasm CDN load | Hardcode a specific CDN URL in source | Pin an explicit version number in the CDN URL so upgrades are intentional, not automatic |
| Web Audio API `decodeAudioData` | Pass raw WebP/WebM bytes directly | Extract the audio track first with FFmpeg, then pass the decoded audio stream to `decodeAudioData` |
| Blob download in Safari | Use `URL.createObjectURL` + `<a download>` | Test in Safari explicitly — iOS Safari has documented bugs with large Blob URLs and anchor-based downloads |
| FFmpeg WASM virtual filesystem | Reuse the same filename on repeat trims | Use unique filenames per operation (e.g., `input_${Date.now()}.webm`) to avoid stale data in the WASM FS |
| wavesurfer.js destroy | Call `destroy()` only when unmounting component | Call `destroy()` before every new file load, not just on unmount |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| WASM heap not flushed between trims | Increasing memory, eventual crash | Call `ffmpeg.deleteFile()` after every operation | After 5-10 trim operations in one session |
| Full-PCM waveform decode into AudioBuffer | Tab crash / long freeze on large files | Downsample waveform data; add file size limit | Audio files over ~50MB |
| Multiple FFmpeg instances alive simultaneously | Exponential memory growth | Singleton FFmpeg instance with loaded-check guard | Immediately if user triggers concurrent trims |
| Processing on main thread | UI freezes, no progress feedback possible | ffmpeg.wasm runs in a Web Worker by default in v0.12+ — verify this is not disabled | Any audio file over a few MB |
| Waveform zoom on long audio | 4GB RAM spike | Limit max zoom, or disable zoom entirely | Audio files over ~10 minutes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Skipping file type validation on input | User loads a non-audio file, gets confusing WASM error | Validate MIME type (`audio/webm`, `video/webm`) and file extension before passing to FFmpeg |
| Displaying raw FFmpeg stderr output in UI | Leaks internal path or system information | Catch FFmpeg errors, show user-friendly messages, log raw stderr to console only in development |
| Trusting Content-Type header alone for input | Misidentified file type, silent failure | Read the first 12 bytes of the file to check the RIFF/WebM magic bytes before processing |

Note: Because this tool is fully client-side with no server and no uploads, standard server-side security concerns (XSS persistence, CSRF, injection) do not apply. The security surface is minimal.

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during WASM init | Users think the page is broken for 5-15 seconds | Show a spinner with "Loading audio processor..." immediately on page load |
| No progress during trim operation | Users double-click the trim button, triggering multiple operations | Disable trim button and show progress during FFmpeg processing |
| Waveform handles snap to wrong position on mobile | Accidental crop on touch | Project targets desktop-only (out of scope), but add touch event guards to prevent accidental handle moves |
| No file size / duration feedback before trimming | User trims then downloads, surprised by large output | Show input duration and file size prominently before trim confirmation |
| Download starts immediately after trim with no preview | User cannot verify trim result before committing | Always show a play-the-trimmed-audio preview step before the download button appears |
| Numeric input and waveform handle get out of sync | User types a number, waveform doesn't update (or vice versa) | Single source of truth for trim points — bind numeric inputs and waveform handles to the same state |

---

## "Looks Done But Isn't" Checklist

- [ ] **FFmpeg initialization:** Loading spinner shown, not just a blank page — verify on a throttled 3G connection
- [ ] **Memory cleanup:** Open DevTools Memory tab, perform 10 trim operations, verify heap does not grow linearly
- [ ] **Blob URL cleanup:** Verify `URL.revokeObjectURL` is called after each download and preview dismiss
- [ ] **Output validity:** Open trimmed output in a second browser tab / media player to confirm it is valid and playable
- [ ] **Trim accuracy:** Measure the output duration against the requested trim range — confirm it matches within one codec frame
- [ ] **Error states:** Drop a JPEG file into the input — confirm a friendly error appears, not a WASM crash
- [ ] **Safari compatibility:** Test the full flow in Safari — Blob download and WASM behavior differ from Chromium
- [ ] **COOP/COEP in production:** If multi-threaded build is used, verify headers are present in production deployment Network tab
- [ ] **Input/output format confirmation:** Run `ffprobe` on a real input file and on the output to verify container format is as expected
- [ ] **Waveform on large file:** Load a 100MB audio file — verify the page does not crash

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WebP-does-not-have-audio (format misidentification) | HIGH — requires redefining the output format requirement | Audit real input files with ffprobe; update requirements to accept WebM input/output if that's the actual format |
| COOP/COEP headers missing in production | LOW — configuration change | Add headers to host config file; redeploy |
| Memory leak discovered post-launch | MEDIUM — requires audit and refactor of processing pipeline | Profile with DevTools, add cleanup calls to every FFmpeg operation, add destroy-before-load to waveform |
| Trim inaccuracy reported by users | MEDIUM — requires changing FFmpeg command from copy to re-encode | Switch `-c copy` to `-c:a libopus` and re-test; may increase processing time slightly |
| WASM crash on large files | LOW — add guard | Add file size check before processing; show error message above threshold |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebP-has-audio assumption unverified | Phase 1 (spike) | Run `ffprobe` on 3+ real input files; confirm container type |
| SharedArrayBuffer / COOP+COEP | Phase 1 (environment setup) | Deploy to production host early; confirm `SharedArrayBuffer` is available |
| WASM bundle load UX | Phase 1 (FFmpeg integration) | Test on throttled connection; loading state must appear before WASM finishes loading |
| Memory leaks (FFmpeg + Blob URLs) | Phase 2 (trim processing) | DevTools memory profiling over 10 operations |
| Trim inaccuracy (stream copy) | Phase 2 (trim processing) | Measure output duration against requested trim |
| Waveform crashes on large files | Phase 2 (waveform visualization) | Load a 100MB test file; tab must not crash |
| Waveform / numeric input state desync | Phase 2 (waveform visualization) | Test both interaction paths update the same state |
| Safari Blob download | Phase 3 (download / export) | Test download flow in Safari explicitly |
| Error states for invalid files | Phase 3 (polish / hardening) | Drop non-audio files and verify friendly errors |

---

## Sources

- [ffmpeg.wasm GitHub — Memory Issues #200, #83, #494, #704](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/200)
- [ffmpeg.wasm GitHub — SharedArrayBuffer Firefox issue #106](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/106)
- [ffmpeg.wasm GitHub — Multithreading Chromium issue #597](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/597)
- [ffmpeg.wasm Docs — Performance](https://ffmpegwasm.netlify.app/docs/performance/)
- [FFmpeg trim inaccuracy — ScribbleGhost post-mortem](https://scribbleghost.net/2018/10/26/cut-video-with-ffmpeg-the-good-the-bad-and-the-ugly/)
- [wavesurfer.js — Crash on large file #2352](https://github.com/katspaugh/wavesurfer.js/issues/2352)
- [wavesurfer.js — Memory not released on destroy #1940](https://github.com/katspaugh/wavesurfer.js/issues/1940)
- [wavesurfer.js — Heavy memory usage zooming #3193](https://github.com/katspaugh/wavesurfer.js/discussions/3193)
- [Google WebP Container Specification](https://developers.google.com/speed/webp/docs/riff_container)
- [MDN — Media container formats (WebM vs WebP distinction)](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)
- [How to deploy ffmpeg.wasm to GitHub Pages (COOP/COEP)](https://dannadori.medium.com/how-to-deploy-ffmpeg-wasm-application-to-github-pages-76d1ca143b17)
- [FileSaver.js — Saving large files (>2GB) #163](https://github.com/eligrey/FileSaver.js/issues/163)
- [Web Audio API performance notes — padenot.github.io](https://padenot.github.io/web-audio-perf/)
- [MDN — Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
- [FFmpeg.wasm React Setup 2025 — debugplay.com](https://debugplay.com/posts/ffmpeg-react-setup/)

---
*Pitfalls research for: browser-based WebP audio trimmer*
*Researched: 2026-03-16*
