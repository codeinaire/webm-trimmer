# Feature Research

**Domain:** Browser-based audio trimmer (client-side, WebP container format)
**Researched:** 2026-03-16
**Confidence:** MEDIUM — core audio trimmer features are well-documented via live tools; WebP-specific audio handling has fewer direct references and relies on ffmpeg.wasm capabilities

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| File load via picker | Entry point to any tool | LOW | `<input type="file">` — trivial |
| Drag-and-drop file load | Every modern web tool supports this | LOW | Drop zone on the page body |
| Waveform visualization | Every audio trimmer renders a waveform — absence signals a broken or untrustworthy tool | MEDIUM | wavesurfer.js Regions plugin is the standard; renders via Web Audio API `decodeAudioData` + Canvas |
| Draggable start/end trim handles | Primary interaction model for all audio trimmers — users arrive expecting this UX pattern | MEDIUM | Two region handles on the waveform; wavesurfer.js Regions plugin provides this out of the box |
| Numeric inputs for trim points | Users needing precision (e.g. "cut first 3.2 s") expect typed inputs alongside visual handles | LOW | Bidirectional binding with the waveform handles; seconds or mm:ss format |
| Playback of trimmed region | Users must be able to hear what they are saving before committing | LOW | Web Audio API or HTML5 `<audio>` element playing the selected region |
| Download / save result | The output of any trimmer — no download = the tool does nothing | HIGH | Requires re-encoding: ffmpeg.wasm `-ss` / `-to` / `-t` copy trim; output as WebP blob, trigger `<a download>` |
| File size display (before/after) | Users expect feedback on how much they are saving — absence feels like something is missing | LOW | Before: `File.size`; after: output Blob byte length |
| Client-side only processing | Privacy expectation is now standard; users notice and distrust tools that upload files | HIGH | ffmpeg.wasm runs entirely in the browser; requires SharedArrayBuffer + COOP/COEP headers |
| Progress/loading indicator | WASM init and audio processing take perceptible time; no spinner = users assume it is broken | LOW | Simple spinner or progress bar during ffmpeg.wasm load and trim operation |
| Error feedback for unsupported files | Users will try MP3, PNG, etc. — silent failure is confusing | LOW | Validate MIME type and container format on load; show human-readable error |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| WebP audio support specifically | No mainstream browser trimmer targets WebP audio — this is the tool's entire reason for existing | HIGH | Requires ffmpeg.wasm with libvpx/libopus support; WebP with audio is effectively a WebM-like container |
| WebP-in, WebP-out preservation | Users keep the same format and container — no silent re-encoding surprises | MEDIUM | `ffmpeg -c copy` for lossless stream copy trim; avoids quality loss |
| Seconds-to-cut framing (not start/end timestamps) | Trimming "cut N seconds from start, M from end" is more intuitive for duration reduction than specifying absolute timestamps | LOW | Simple arithmetic on top of the underlying start/end model; a UI framing choice, not a technical one |
| Instant waveform decode feedback | Show waveform as soon as file is loaded, before any interaction | LOW | Web Audio API `decodeAudioData` is fast for typical audio files; makes the tool feel responsive |
| Estimated output size in real time | Updating size estimate as handles are dragged — not just a static before/after | LOW | Approximate: `(trim_duration / total_duration) * original_size`; accurate enough to be useful |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Format conversion (WebP to MP3/WAV/etc.) | Users often want the audio in a common format | Out of scope per PROJECT.md; adds significant surface area; any format output requires re-encoding pipelines and format-specific codec flags | Stay WebP-in, WebP-out — be explicit about this constraint in the UI |
| Image/frame editing | WebP is an image format; users might expect to crop frames | PROJECT.md explicitly rules this out; unrelated domain; would require canvas + image processing pipeline | Document clearly: "audio timeline only" |
| Cloud storage save (Google Drive, Dropbox) | Competitors like mp3cut.net offer this | Requires OAuth flows, third-party SDKs, and defeats the client-side simplicity story | Browser download is sufficient; keep the no-server guarantee clean |
| Fade in / fade out effects | Every competitor offers this; users ask for it | Requires audio re-encoding (cannot use `-c copy`); adds encoding time, quality concerns, and ffmpeg complexity | Defer to v2 — add as explicit opt-in once core trim works with copy |
| Batch file processing | Power users want to trim multiple files | Multiplies WASM memory pressure; high implementation complexity for a trimmer tool | Single file focus keeps UX clear; batch is a separate product decision |
| Mobile-optimized UI | Broad device support | PROJECT.md marks desktop browser as primary target; touch drag handles on small screens are finicky and require a different interaction model | Desktop first; responsive layout can be added later without redesign |
| Undo/redo history | All editors have undo | Stateful undo tracking for a two-handle trim is over-engineering; users can just drag the handles back | Re-draggable handles already provide the equivalent of "undo" |
| AI-suggested trim points | Trendy feature in 2025-era tools | Requires ML inference (on-device or server), adds latency and bundle size; value is unclear for duration trimming vs. content editing | Manual handles + numeric inputs cover the actual need |

## Feature Dependencies

```
File Load (picker or drag-and-drop)
    └──requires──> ffmpeg.wasm init
                       └──requires──> SharedArrayBuffer (COOP/COEP headers)

File Load
    └──enables──> Waveform Visualization
                      └──requires──> Web Audio API decodeAudioData

Waveform Visualization
    └──enables──> Draggable Trim Handles
                      └──requires──> wavesurfer.js Regions plugin

Draggable Trim Handles
    └──syncs with──> Numeric Inputs (bidirectional)

Draggable Trim Handles
    └──enables──> Playback Preview (plays region only)

Draggable Trim Handles + Numeric Inputs
    └──enables──> Estimated Output Size (real-time)

Playback Preview + Trim Handles
    └──enables──> Download / Save (ffmpeg.wasm trim + output blob)

File Load
    └──enables──> File Size Display (before: File.size)

Download
    └──enables──> File Size Display (after: output blob size)
```

### Dependency Notes

- **ffmpeg.wasm requires SharedArrayBuffer:** COOP (`Cross-Origin-Opener-Policy: same-origin`) and COEP (`Cross-Origin-Embedder-Policy: require-corp`) headers must be set on the server (or via a Service Worker hack for static hosting). This is a deployment constraint, not a code constraint.
- **Waveform requires `decodeAudioData`:** ffmpeg.wasm must first extract the audio stream before the Web Audio API can decode it for visualization. The waveform cannot be shown from the raw WebP bytes alone.
- **Numeric inputs and handles must stay in sync:** If either updates, the other must reflect it. This bidirectional binding is a small but error-prone implementation detail.
- **`-c copy` trim preserves quality but has a limitation:** Stream copy trim can only cut at keyframe boundaries in some codecs. For WebP/Opus audio streams this is generally fine at any point, but should be verified with ffmpeg.wasm.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] File load via picker + drag-and-drop — entry point; without this nothing works
- [ ] Waveform visualization — core UX; absence makes the tool unusable
- [ ] Draggable start/end trim handles — primary interaction model
- [ ] Numeric inputs for trim points (seconds to cut from start/end) — precision control per PROJECT.md requirements
- [ ] Playback preview of selected region — users must hear before saving
- [ ] Download trimmed WebP — the actual output; without this the tool is a toy
- [ ] File size before/after display — feedback on the result; low cost, high value
- [ ] Progress indicator during ffmpeg.wasm load and trim — prevents confusion during latency
- [ ] Error message for non-WebP or unsupported files — prevents silent failures

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Real-time estimated output size as handles drag — nice UX improvement; add when core is stable
- [ ] Keyboard nudge for trim handles (arrow keys) — precision without numeric inputs; add if users report frustration
- [ ] Improved error messages with file format details — add if bug reports show users confused about supported formats

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Fade in / fade out — requires re-encoding pass; defer until core copy-trim is proven reliable
- [ ] Mobile touch interaction — defer per PROJECT.md; requires redesigned handle UX
- [ ] Batch trimming — high complexity; only worth adding if single-file use is validated

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File load (picker + drag-and-drop) | HIGH | LOW | P1 |
| Waveform visualization | HIGH | MEDIUM | P1 |
| Draggable trim handles | HIGH | MEDIUM | P1 |
| Numeric trim inputs | HIGH | LOW | P1 |
| Playback preview | HIGH | LOW | P1 |
| Download trimmed WebP | HIGH | HIGH | P1 |
| File size before/after | MEDIUM | LOW | P1 |
| Progress indicator | MEDIUM | LOW | P1 |
| Error feedback | MEDIUM | LOW | P1 |
| Real-time size estimate on drag | MEDIUM | LOW | P2 |
| Keyboard nudge on handles | LOW | LOW | P2 |
| Fade in/out | MEDIUM | HIGH | P3 |
| Mobile UI | LOW | HIGH | P3 |
| Batch trimming | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | mp3cut.net | audiotrimmer.com | Our Approach |
|---------|------------|------------------|--------------|
| Waveform + drag handles | Yes, slider-based | Yes, handles on waveform | Yes — wavesurfer.js Regions |
| Numeric time inputs | Yes | Yes (arrow keys + input boxes) | Yes — seconds-to-cut framing |
| Playback preview | Yes | Yes | Yes |
| File size display | No | No | Yes — differentiator |
| Format output | 300+ formats | 12+ formats | WebP only — by design |
| Client-side processing | No (server) | No (server) | Yes — core differentiator |
| WebP audio support | Unclear | No | Yes — the entire point |
| Fade in/out | Yes | Yes | Deferred to v2 |
| Cloud storage upload | Yes | No | No — defeats privacy story |
| Mobile support | Yes | Yes | Deferred |

## Sources

- [mp3cut.net](https://mp3cut.net/) — competitor feature audit
- [audiotrimmer.com](https://audiotrimmer.com/) — competitor feature audit
- [Riverside.fm: Best Audio Trimmers 2026](https://riverside.com/blog/best-audio-trimmers) — market survey
- [ffmpeg.wasm official docs](https://ffmpegwasm.netlify.app/docs/overview/) — client-side processing capabilities
- [ffmpeg.wasm GitHub](https://github.com/ffmpegwasm/ffmpeg.wasm) — SharedArrayBuffer/COOP/COEP requirements
- [wavesurfer.js Regions plugin](https://wavesurfer.xyz/plugins/regions) — waveform + drag handle implementation
- [MDN: BaseAudioContext.decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) — waveform data source
- [MDN: FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) — file size and array buffer access
- [DEV Community: FFmpeg WASM memory limits](https://dev.to/digitalofen/i-tried-running-file-conversion-fully-in-the-browser-wasm-libreoffice-ffmpeg-57mh) — WASM memory constraints

---
*Feature research for: browser-based WebP audio trimmer*
*Researched: 2026-03-16*
