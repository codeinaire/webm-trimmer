# Architecture Research

**Domain:** Client-side browser-based audio media processing tool (WebP trimmer)
**Researched:** 2026-03-16
**Confidence:** HIGH (core FFmpeg.wasm architecture from official docs; WaveSurfer.js from official docs; Web Audio API from MDN)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER (Main Thread)                    │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  File Loader │   Waveform   │  Trim Control│  Playback Controls │
│  (drop/pick) │  (Canvas)    │  (handles +  │  (play/stop,       │
│              │              │   inputs)    │   size display)    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
┌──────▼──────────────▼──────────────▼────────────────▼───────────┐
│                    APPLICATION STATE (Zustand)                    │
│  file: File | null                                               │
│  audioBuffer: AudioBuffer | null   (for waveform render)         │
│  trimStart: number (seconds)                                     │
│  trimEnd: number (seconds)                                       │
│  duration: number (seconds)                                      │
│  status: idle | loading | decoding | trimming | done | error    │
│  originalSize: number | null                                     │
│  outputBlob: Blob | null                                         │
└──────┬──────────────┬──────────────────────────────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼────────────────────────────────────────┐
│  Web Audio  │ │              FFmpeg.wasm Service              │
│  API Layer  │ │  (Worker thread via @ffmpeg/ffmpeg)           │
│             │ │                                               │
│ AudioContext│ │  Virtual FS: writeFile / readFile             │
│ decodeAudio │ │  exec: ffmpeg -i input.webp -ss [start]       │
│ Data()      │ │        -to [end] -c copy output.webp          │
│ getChannel  │ │                                               │
│ Data() for  │ │  Worker MessagePassing: async/await           │
│ waveform    │ └───────────────────────────────────────────────┘
└─────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| File Loader | Accept File input, read as ArrayBuffer, trigger decode pipeline | `<input type="file">` + drag-drop events, FileReader API |
| Audio Decoder | Decode ArrayBuffer to AudioBuffer for waveform data | `AudioContext.decodeAudioData()` — Web Audio API |
| Waveform Renderer | Draw amplitude data as waveform on Canvas, respond to resize events | WaveSurfer.js v7 or raw Canvas with `getChannelData()` |
| Trim Handle Controller | Expose draggable region handles on waveform, sync with numeric inputs | WaveSurfer.js Regions plugin; events `update-end` → trimStart/trimEnd state |
| Numeric Inputs | Precise seconds-from-start / seconds-from-end inputs, validate within duration bounds | Controlled inputs bound to app state |
| Playback Controller | Play preview of trimmed segment using Web Audio API; stop on overlap with trim state | `AudioBufferSourceNode` offset + duration params |
| FFmpeg.wasm Service | Load WASM worker, execute trim command, return output Blob | `@ffmpeg/ffmpeg` + `@ffmpeg/core`; `writeFile / exec / readFile` |
| Size Display | Compute and display original file size + estimated/actual output size | Derived from `File.size` and `outputBlob.size` |
| Download Trigger | Create object URL from output Blob, simulate anchor click | `URL.createObjectURL()` + `<a download>` |

## Recommended Project Structure

```
src/
├── components/              # UI components (framework-specific)
│   ├── FileLoader.tsx        # Drop zone + file picker
│   ├── WaveformView.tsx      # WaveSurfer.js mount + region sync
│   ├── TrimControls.tsx      # Numeric inputs for start/end
│   ├── PlaybackBar.tsx       # Play/stop preview controls
│   └── OutputPanel.tsx       # Size info + download button
├── services/
│   ├── ffmpeg.ts             # FFmpeg.wasm singleton: load(), trim()
│   └── audioDecoder.ts       # AudioContext.decodeAudioData wrapper
├── store/
│   └── trimStore.ts          # Zustand store — single source of truth
├── utils/
│   ├── waveform.ts           # getChannelData → Float32Array → peaks array
│   └── formatTime.ts         # seconds → MM:SS display helpers
└── main.tsx                  # App entry, WASM preload
```

### Structure Rationale

- **services/**: FFmpeg.wasm and AudioContext are stateful singletons with async lifecycle (load/init). Isolating them prevents component-level coupling and makes the WASM worker easy to lazy-init once.
- **store/**: All trim state lives in one place. WaveformView writes `trimStart`/`trimEnd` via region events; TrimControls writes the same keys via inputs. Neither component owns the state.
- **components/**: Each component is display-only or tightly scoped. No component calls FFmpeg directly.

## Architectural Patterns

### Pattern 1: Worker-Isolated Processing (Mandatory for FFmpeg.wasm)

**What:** FFmpeg runs entirely inside a Web Worker (`@ffmpeg/core`). The main thread communicates via message-passing wrapped in async/await by the `@ffmpeg/ffmpeg` JS API.

**When to use:** Any time you run FFmpeg.wasm — this is the required architecture. Do not run FFmpeg on the main thread; it will block the UI for seconds.

**Trade-offs:** Async-only interface (always `await`); requires COOP/COEP headers for multi-threaded core; adds ~1-2s initial WASM load time.

**Example:**
```typescript
// services/ffmpeg.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()

export async function ensureLoaded() {
  if (!ffmpeg.loaded) {
    await ffmpeg.load() // downloads ~30MB WASM core once
  }
}

export async function trimWebP(
  inputFile: File,
  startSec: number,
  endSec: number
): Promise<Uint8Array> {
  await ensureLoaded()
  await ffmpeg.writeFile('input.webp', await fetchFile(inputFile))
  await ffmpeg.exec([
    '-i', 'input.webp',
    '-ss', String(startSec),
    '-to', String(endSec),
    '-c', 'copy',           // stream copy: no re-encode
    'output.webp'
  ])
  return ffmpeg.readFile('output.webp') as Promise<Uint8Array>
}
```

### Pattern 2: Two-Decode Strategy (ArrayBuffer used twice)

**What:** The input file is decoded twice from its `ArrayBuffer`: once by `AudioContext.decodeAudioData()` for waveform visualization (fast, lossless PCM extraction), and once by FFmpeg.wasm for the actual trim operation (writes to VFS as raw bytes).

**When to use:** Any time you need both waveform data and processing output from the same file. Do not pipe FFmpeg output through Web Audio API — they are independent paths.

**Trade-offs:** Slight memory overhead (two representations in memory simultaneously); clean separation means waveform rendering doesn't depend on FFmpeg being loaded.

```typescript
// services/audioDecoder.ts
export async function decodeForWaveform(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  return ctx.decodeAudioData(arrayBuffer.slice(0)) // slice: don't consume original
}
```

### Pattern 3: Region-State Sync (WaveSurfer Regions → App State)

**What:** WaveSurfer Regions plugin owns the visual drag interaction. On `region-update-end` events, it writes back to the Zustand store (`trimStart`, `trimEnd`). Numeric inputs are controlled components bound to the same store values. All reads of trim points come from the store — never from the WaveSurfer instance directly in other components.

**When to use:** Any waveform interaction where you need the trim state shared across components (inputs, preview, export).

**Trade-offs:** Adds one indirection (region → store → inputs), but prevents two-way binding nightmares where inputs and handles fight over truth.

```typescript
// components/WaveformView.tsx (sketch)
const { setTrimStart, setTrimEnd, duration } = useTrimStore()

wavesurfer.on('region-update-end', (region) => {
  setTrimStart(region.start)
  setTrimEnd(region.end)
})
```

## Data Flow

### Primary Flow: File to Waveform

```
User selects file
    ↓
FileLoader → File object → store.setFile(file)
    ↓
audioDecoder.decodeForWaveform(arrayBuffer)    [Web Audio API, fast]
    ↓
AudioBuffer → getChannelData(0) → peaks[]
    ↓
WaveformView renders peaks on Canvas
    ↓
Regions plugin creates initial region spanning full duration
    ↓
store: trimStart=0, trimEnd=duration
```

### Secondary Flow: Trim to Download

```
User adjusts handles / inputs
    ↓
store: trimStart=X, trimEnd=Y
    ↓
User clicks "Trim & Download"
    ↓
ffmpeg.trimWebP(file, trimStart, trimEnd)      [Web Worker, slow]
    ↓
Uint8Array → new Blob([...], {type:'audio/webp'})
    ↓
store: outputBlob=blob, status=done
    ↓
OutputPanel shows outputSize
    ↓
User clicks Download → URL.createObjectURL(blob) → <a download>
```

### Preview Flow

```
User clicks Play
    ↓
AudioContext.createBufferSource()
    ↓
source.buffer = audioBuffer (already decoded)
source.start(0, trimStart, trimEnd - trimStart)  [offset + duration]
    ↓
Plays trimmed segment live — no FFmpeg needed for preview
```

### State Lifecycle

```
[idle]
  → file dropped          → [loading/decoding]
  → decode complete       → [ready]
  → trim clicked          → [trimming]
  → ffmpeg complete       → [done]
  → any error             → [error]
```

## Scaling Considerations

This is a single-user local tool. "Scaling" here means file size handling, not user load.

| File Size | Architecture Adjustments |
|-----------|--------------------------|
| < 5 MB | No special handling; fits entirely in memory twice (AudioBuffer + VFS) |
| 5–50 MB | Add progress reporting via `ffmpeg.on('progress', ...)` to show % complete |
| > 50 MB | Stream input using chunked reads; may hit WASM memory limits (~2GB heap) |

### Scaling Priorities

1. **First bottleneck:** WASM initial load (~30MB download). Mitigate with lazy load on first file drop, not on page open.
2. **Second bottleneck:** AudioBuffer memory for large files. `decodeAudioData` creates uncompressed PCM (~10x file size). For a 50MB WebP that may be 500MB. Downsample to mono before waveform rendering.

## Anti-Patterns

### Anti-Pattern 1: Running FFmpeg on Main Thread

**What people do:** Call `ffmpeg.exec()` without the worker setup, or inline in a React event handler directly.
**Why it's wrong:** FFmpeg processing is CPU-intensive and will freeze the browser tab for several seconds, especially on large files.
**Do this instead:** Always use the worker (default in `@ffmpeg/ffmpeg`). Disable UI controls (set `status = 'trimming'`) while processing runs so users don't re-trigger.

### Anti-Pattern 2: Using FFmpeg Output as Waveform Source

**What people do:** Feed the FFmpeg-trimmed output back through `decodeAudioData` to generate the preview waveform.
**Why it's wrong:** Requires running FFmpeg before the user can even see the waveform; adds 2-5 second blocking before any UI appears; couples two independent concerns.
**Do this instead:** Decode the original file once via `AudioContext.decodeAudioData()` immediately on load. The waveform render and the trim operation are completely independent pipelines.

### Anti-Pattern 3: WaveSurfer as State Owner

**What people do:** Read `wavesurfer.regions.list` from anywhere in the component tree to get current trim points.
**Why it's wrong:** Creates hidden coupling between unrelated components; regions list can be stale if WaveSurfer instance is replaced; breaks numeric input ↔ handle bidirectional sync.
**Do this instead:** On every `region-update-end` event, push values into the central store. All other components read from the store. WaveSurfer is write-only for state purposes.

### Anti-Pattern 4: Missing COOP/COEP Headers

**What people do:** Deploy ffmpeg.wasm (`@ffmpeg/core-mt`) without configuring Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers.
**Why it's wrong:** `SharedArrayBuffer` (required for multi-threaded WASM) is disabled by browsers without cross-origin isolation. The app silently falls back to the single-threaded core or crashes.
**Do this instead:** Configure headers at the dev server (Vite `server.headers`) and at the production host. Use `@ffmpeg/core` (single-threaded) if you can't control headers; it's slower but requires no special headers.

## Integration Points

### External Services

None — this is fully client-side.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| FileLoader → store | Direct store write on file pick | `store.setFile(file)` — no events |
| store → audioDecoder | Effect/hook reads `store.file`, calls decode | Decode triggers automatically on file change |
| audioDecoder → WaveformView | Passes `peaks[]` or `AudioBuffer` as prop | WaveSurfer can accept pre-decoded peaks or AudioBuffer directly |
| WaveformView → store | Region events push trimStart/trimEnd | `region-update-end` → `store.setTrimPoints()` |
| store → TrimControls | Controlled inputs read from store | Bidirectional: input change also writes to store |
| store → ffmpeg service | Trim button handler reads trimStart/trimEnd from store | One-way: store is read at call time |
| ffmpeg service → store | Returns `Uint8Array`, caller writes to store | `store.setOutputBlob(blob)` on success |

### Build Order Implications

Build components in this dependency order — each layer depends on the one below:

1. **Zustand store** — no dependencies; defines the shared state shape
2. **FFmpeg service** — no UI dependencies; can be unit-tested standalone
3. **audioDecoder service** — no UI dependencies; stable before waveform work starts
4. **FileLoader component** — depends only on store (`setFile`)
5. **WaveformView component** — depends on audioDecoder output + store for region sync
6. **TrimControls component** — depends on store (reads trimStart/trimEnd/duration)
7. **PlaybackBar component** — depends on audioDecoder output (AudioBuffer) + store (trimStart/trimEnd)
8. **OutputPanel + Download** — depends on FFmpeg service output via store

This order means each phase can be integrated and tested before the next one starts.

## Sources

- [ffmpeg.wasm official docs — Overview](https://ffmpegwasm.netlify.app/docs/overview/) — HIGH confidence
- [ffmpeg.wasm DeepWiki architecture breakdown](https://deepwiki.com/ffmpegwasm/ffmpeg.wasm) — HIGH confidence
- [WaveSurfer.js Regions plugin docs](https://wavesurfer.xyz/plugins/regions) — HIGH confidence
- [WaveSurfer.js official site](https://wavesurfer.xyz/) — HIGH confidence
- [Web Audio API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — HIGH confidence
- [Vite + ffmpeg.wasm COOP/COEP setup guide](https://debugplay.com/posts/ffmpeg-react-setup/) — MEDIUM confidence
- [BBC waveform-data.js (AudioBuffer → peaks pattern)](https://github.com/bbc/waveform-data.js) — MEDIUM confidence

---
*Architecture research for: client-side browser WebP audio trimmer*
*Researched: 2026-03-16*
