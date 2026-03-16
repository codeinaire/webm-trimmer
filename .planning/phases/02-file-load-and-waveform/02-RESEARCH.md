# Phase 2: File Load and Waveform — Research

**Researched:** 2026-03-16
**Domain:** Browser file input, Web Audio API decode, wavesurfer.js v7, Zustand state, format validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Format is WebM/Opus (confirmed by ffprobe) — accept `.webm` files
- `AudioContext.decodeAudioData` natively handles WebM/Opus — use for waveform rendering
- Two-decode strategy: Web Audio API for waveform display, ffmpeg.wasm only at trim time (Phase 4)
- wavesurfer.js v7 with Regions plugin for waveform (already installed in package.json)
- Zustand for state management (already installed)
- `src/services/ffmpeg.ts` singleton exists but NOT needed for this phase (waveform uses Web Audio API)

### Claude's Discretion
- Waveform appearance (color, height, style) — use wavesurfer.js defaults or whatever looks clean
- Error message design and tone for unsupported files
- Page layout and component structure around the waveform
- File picker styling and placement
- Loading states during audio decode
- How format identification (WebM vs other) is displayed to the user

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOAD-01 | User can load a file via file picker | `<input type="file">` with `accept=".webm,audio/webm"`, File object passed to decode pipeline |
| FMT-01 | App validates input file format and confirms whether it's WebP or WebM container | Magic-byte check on first 4 bytes (`1a 45 df a3` = WebM EBML; `52 49 46 46` = RIFF/WebP); MIME type secondary check |
| FMT-02 | App shows clear error message for unsupported file types | Error state in Zustand store; conditional render in UI; WASM never receives invalid files |
| WAVE-01 | App displays audio waveform visualization of the loaded file | `AudioContext.decodeAudioData` → `getChannelData(0)` → wavesurfer.js `loadDecodedBuffer` or `load('', peaks, duration)` |
</phase_requirements>

---

## Summary

Phase 2 replaces the smoke-test `App.tsx` with a real three-part UI: a file picker, format validation with clear errors, and a rendered waveform. The format is confirmed WebM/Opus from Phase 1 ffprobe results — format validation is now about distinguishing valid WebM input from everything else, not about discovering the format.

The waveform pipeline is entirely Web Audio API + wavesurfer.js v7, with zero ffmpeg.wasm involvement. The user selects a file, the app reads it as an `ArrayBuffer`, validates magic bytes, decodes audio via `AudioContext.decodeAudioData`, extracts the channel data, and passes it to wavesurfer.js. The entire decode pipeline is fast (sub-second for typical files) and runs on the main thread inside a `useEffect`.

Zustand scaffolding built this phase covers the state shape that Phases 3 and 4 will extend — `file`, `audioBuffer`, `duration`, `status`, and `errorMessage`. Getting this store right now prevents bidirectional-sync bugs in Phase 3.

**Primary recommendation:** Build in this order: Zustand store → audioDecoder service → FileLoader component → WaveformView component → format validation error UI.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wavesurfer.js | ^7.12.3 | Waveform rendering | Already installed; v7 has improved memory management; `loadDecodedBuffer` API avoids CORS/fetch entirely |
| Zustand | ^5.0.12 | App state | Already installed; minimal boilerplate; single source of truth for file/audio/status/trim state |
| Web Audio API | Native browser | Decode WebM/Opus to PCM | No install; `AudioContext.decodeAudioData` natively handles WebM/Opus in Chrome, Firefox, Safari |
| React 19 | ^19.2.4 | UI | Already installed |
| TypeScript 5.9 | ~5.9.3 | Type safety | Already installed |

### No New Installs Needed

All required packages are already present in `package.json`. This phase introduces no new dependencies.

---

## Architecture Patterns

### Recommended File Structure for This Phase

```
src/
├── components/
│   ├── FileLoader.tsx       # <input type="file"> + drag-drop (Phase 2 only adds picker)
│   └── WaveformView.tsx     # wavesurfer.js mount, AudioBuffer rendering
├── services/
│   └── audioDecoder.ts     # AudioContext.decodeAudioData wrapper (NEW)
├── store/
│   └── trimStore.ts        # Zustand store — file, audioBuffer, duration, status (NEW)
├── utils/
│   └── formatValidation.ts # Magic-byte check + MIME type check (NEW)
├── App.tsx                 # Replace smoke test with real layout
└── services/
    └── ffmpeg.ts           # Unchanged — not used this phase
```

### Pattern 1: Zustand Store Shape

**What:** Define the complete store shape for the app now, even though only file/audio/waveform fields are used this phase. Phases 3 and 4 will add trim and output fields — define those as `null` stubs so the type contract is clear.

**When to use:** Always define the store shape before building components that read from it.

```typescript
// src/store/trimStore.ts
import { create } from 'zustand'

type AppStatus = 'idle' | 'decoding' | 'ready' | 'error'

interface TrimStore {
  // Phase 2 fields
  file: File | null
  audioBuffer: AudioBuffer | null
  duration: number
  status: AppStatus
  errorMessage: string | null

  // Phase 3 stubs (set to initial values, populated in Phase 3)
  trimStart: number
  trimEnd: number

  // Phase 4 stubs
  outputBlob: Blob | null

  // Actions
  setFile: (file: File) => void
  setAudioBuffer: (buf: AudioBuffer) => void
  setStatus: (status: AppStatus, error?: string) => void
  reset: () => void
}

export const useTrimStore = create<TrimStore>((set) => ({
  file: null,
  audioBuffer: null,
  duration: 0,
  status: 'idle',
  errorMessage: null,
  trimStart: 0,
  trimEnd: 0,
  outputBlob: null,

  setFile: (file) => set({ file, status: 'decoding', errorMessage: null }),
  setAudioBuffer: (buf) =>
    set({ audioBuffer: buf, duration: buf.duration, trimEnd: buf.duration, status: 'ready' }),
  setStatus: (status, error = undefined) =>
    set({ status, errorMessage: error ?? null }),
  reset: () =>
    set({ file: null, audioBuffer: null, duration: 0, status: 'idle',
          errorMessage: null, trimStart: 0, trimEnd: 0, outputBlob: null }),
}))
```

### Pattern 2: Format Validation via Magic Bytes

**What:** Read the first 4 bytes of the selected file before passing it to `decodeAudioData`. WebM/EBML starts with `1a 45 df a3`. RIFF (WebP, WAV) starts with `52 49 46 46`. This is the correct way to validate — MIME type and file extension are both unreliable.

**When to use:** Before every file decode; in the FileLoader component or as a utility called from the decode pipeline.

```typescript
// src/utils/formatValidation.ts
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]

export type FormatCheckResult =
  | { valid: true; container: 'webm' }
  | { valid: false; container: 'webp' | 'riff' | 'unknown'; reason: string }

export async function checkFileFormat(file: File): Promise<FormatCheckResult> {
  const slice = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(slice)

  if (WEBM_MAGIC.every((b, i) => bytes[i] === b)) {
    return { valid: true, container: 'webm' }
  }

  if (RIFF_MAGIC.every((b, i) => bytes[i] === b)) {
    // RIFF header — likely WebP or WAV
    return {
      valid: false,
      container: 'webp',
      reason: 'This file uses the RIFF/WebP container format, which does not support audio. Load a .webm file recorded by Chrome or another WebM-compatible tool.',
    }
  }

  return {
    valid: false,
    container: 'unknown',
    reason: `Unrecognised file format (magic bytes: ${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}). Load a .webm audio file.`,
  }
}
```

### Pattern 3: Audio Decode Service

**What:** Wrap `AudioContext.decodeAudioData` in a service function. Use `arrayBuffer.slice(0)` to avoid consuming the original buffer (required if ffmpeg.wasm will read the same bytes later in Phase 4).

```typescript
// src/services/audioDecoder.ts
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export async function decodeForWaveform(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  // slice(0) creates a copy — original remains readable for ffmpeg VFS write in Phase 4
  return ctx.decodeAudioData(arrayBuffer.slice(0))
}
```

### Pattern 4: wavesurfer.js v7 with Decoded Buffer

**What:** Use `wavesurfer.loadDecodedBuffer(audioBuffer)` (v7 API) to pass an already-decoded `AudioBuffer` directly to wavesurfer, bypassing any HTTP fetch. This is the correct path when the file is loaded locally — no Blob URL, no CORS, no network.

**When to use:** Always, for local file loading.

```typescript
// src/components/WaveformView.tsx (key fragment)
import WaveSurfer from 'wavesurfer.js'

const containerRef = useRef<HTMLDivElement>(null)
const wsRef = useRef<WaveSurfer | null>(null)

useEffect(() => {
  if (!containerRef.current || !audioBuffer) return

  // Destroy previous instance before creating a new one (prevents memory leak)
  wsRef.current?.destroy()

  wsRef.current = WaveSurfer.create({
    container: containerRef.current,
    waveColor: '#4a9eff',
    progressColor: '#1a6fc4',
    height: 80,
    interact: false,  // Phase 3 adds Regions; disable click-to-seek for now
  })

  wsRef.current.loadDecodedBuffer(audioBuffer)

  return () => {
    wsRef.current?.destroy()
    wsRef.current = null
  }
}, [audioBuffer])
```

### Pattern 5: File Loading Orchestration in App.tsx

**What:** App.tsx coordinates file pick → validation → decode → store update. It replaces the smoke-test UI entirely.

```typescript
// App.tsx (key logic)
async function handleFileChange(file: File) {
  const check = await checkFileFormat(file)
  if (!check.valid) {
    setStatus('error', check.reason)
    return
  }
  setFile(file)
  try {
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await decodeForWaveform(arrayBuffer)
    setAudioBuffer(audioBuffer)
  } catch (err) {
    setStatus('error', `Could not decode audio: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

### Anti-Patterns to Avoid

- **Creating WaveSurfer on every render:** Create inside `useEffect` with `audioBuffer` as dependency, not at component mount. Always call `destroy()` before creating a new instance.
- **Using wavesurfer `load(url)` for local files:** This triggers an HTTP fetch. Use `loadDecodedBuffer(audioBuffer)` instead.
- **Passing raw File bytes to `decodeAudioData` without slicing:** If the same `ArrayBuffer` is later handed to ffmpeg.wasm (Phase 4), `decodeAudioData` consuming it will cause a detached buffer error. Always `slice(0)`.
- **Reading MIME type or extension for format validation:** Both are unreliable. Use magic bytes only.
- **Instantiating `AudioContext` at module load time:** Browsers block AudioContext creation before user gesture. Create lazily on first use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waveform canvas rendering | Custom Canvas peak-drawing code | `wavesurfer.loadDecodedBuffer()` | 200+ lines of amplitude normalisation, pixel-ratio handling, resize observers — all built in |
| Audio format decoding | Manual WebM/Opus byte parsing | `AudioContext.decodeAudioData` | Browser-native; handles codec negotiation, sample rate conversion, channel mixing automatically |
| State synchronisation | Custom event emitter or React context cascade | Zustand store | Prevents bidirectional-sync bugs that will appear in Phase 3 |
| File type sniffing | Extension check or MIME type check | 4-byte magic number check | Extension and MIME type are both user-controlled and wrong for mislabeled files |

---

## Common Pitfalls

### Pitfall 1: WaveSurfer Instance Not Destroyed Before New File Load

**What goes wrong:** User loads File A, sees waveform. Loads File B. Two WaveSurfer instances now share the same DOM container — visual corruption, doubled event listeners, memory leak.

**Why it happens:** `WaveSurfer.create()` attaches to the container but the previous instance still holds a reference to the same canvas element.

**How to avoid:** Store the WaveSurfer instance in a `useRef`. In the `useEffect` cleanup and at the top of the creation block, call `wsRef.current?.destroy()` before calling `WaveSurfer.create()` again.

**Warning signs:** Waveform looks doubled or corrupted on second file load.

### Pitfall 2: AudioContext Blocked Before User Gesture

**What goes wrong:** `new AudioContext()` called at module load time or in a `useEffect` that runs before any user interaction. Chrome and Safari block this and log `AudioContext was not allowed to start`.

**Why it happens:** Browser autoplay policy requires a user gesture before creating an AudioContext.

**How to avoid:** Create the AudioContext inside `getAudioContext()` called lazily from `decodeForWaveform()`, which is only called after the user selects a file (a user gesture).

**Warning signs:** `decodeAudioData` call never resolves; AudioContext state is `suspended`.

### Pitfall 3: ArrayBuffer Consumed by decodeAudioData

**What goes wrong:** `decodeAudioData` detaches the input `ArrayBuffer` (marks it as neutered/transferred). If you then try to pass the same buffer to ffmpeg.wasm in Phase 4, you get `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer`.

**Why it happens:** The Web Audio API spec transfers ownership of the buffer for performance.

**How to avoid:** Always call `decodeForWaveform(arrayBuffer.slice(0))`. Keep the original `arrayBuffer` in the Zustand store (or re-read the `File` object) for the Phase 4 ffmpeg path.

**Warning signs:** `detached ArrayBuffer` error when trim is attempted in Phase 4.

### Pitfall 4: File Size Guard Missing

**What goes wrong:** User loads a 200MB audio file. `decodeAudioData` loads the entire file as uncompressed PCM (~10x size = 2GB), crashing the browser tab.

**Why it happens:** No size check before decode.

**How to avoid:** Reject files above a reasonable threshold (50MB is safe for this use case) with a clear error message before attempting decode.

**Warning signs:** Tab crashes or hangs on large files.

---

## Code Examples

### Complete Decode Pipeline (verified pattern)

```typescript
// Orchestration — called from FileLoader onChange handler
async function loadAudioFile(file: File) {
  // 1. Validate format
  const check = await checkFileFormat(file)
  if (!check.valid) {
    useTrimStore.getState().setStatus('error', check.reason)
    return
  }

  // 2. Guard on file size
  if (file.size > 50 * 1024 * 1024) {
    useTrimStore.getState().setStatus('error', 'File is too large (max 50 MB). Select a shorter recording.')
    return
  }

  // 3. Update store — triggers 'decoding' status / loading UI
  useTrimStore.getState().setFile(file)

  // 4. Read bytes and decode
  try {
    const arrayBuffer = await file.arrayBuffer()
    // Store original arrayBuffer for Phase 4 ffmpeg use
    // Pass a copy to decodeAudioData (it detaches the buffer)
    const audioBuffer = await decodeForWaveform(arrayBuffer)
    useTrimStore.getState().setAudioBuffer(audioBuffer)
  } catch (err) {
    useTrimStore.getState().setStatus('error',
      `Could not decode audio: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

### WaveSurfer v7 loadDecodedBuffer API

```typescript
// wavesurfer.js v7 — pass AudioBuffer directly, no URL needed
const ws = WaveSurfer.create({ container: containerRef.current! })
ws.loadDecodedBuffer(audioBuffer)
// audioBuffer.duration is available immediately after this call
```

### File Input Component

```typescript
// Minimal controlled file input
function FileLoader() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadAudioFile(file)
    e.target.value = ''  // reset so same file can be re-selected
  }
  return (
    <label>
      <input
        type="file"
        accept=".webm,audio/webm,video/webm"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      Open file
    </label>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `wavesurfer.load(blobURL)` for local files | `wavesurfer.loadDecodedBuffer(audioBuffer)` | Eliminates Blob URL creation/revocation and fetch overhead |
| `useRegions()` hook (wavesurfer React wrapper) | Direct `WaveSurfer.create()` inside `useEffect` with a `ref` | No React wrapper needed; wavesurfer.js v7 works cleanly as vanilla JS in a hook |
| `createFFmpeg()` (v0.11 API) | `new FFmpeg()` + `ffmpeg.load({ coreURL, wasmURL })` | Old API throws at runtime with v0.12 packages — already using correct pattern in `src/services/ffmpeg.ts` |

---

## Open Questions

1. **Should the original ArrayBuffer be stored in the Zustand store for Phase 4?**
   - What we know: `File.arrayBuffer()` can be called again on the same `File` object at any time — `File` objects are not consumed.
   - What's unclear: Whether it is cleaner to re-read the File in Phase 4 vs store the ArrayBuffer.
   - Recommendation: Re-read the `File` object in Phase 4 (call `file.arrayBuffer()` again). Storing the raw ArrayBuffer in Zustand is wasteful memory. Store only `file: File | null`.

2. **wavesurfer.js `loadDecodedBuffer` vs `load('', peaks, duration)`**
   - What we know: Both APIs exist in v7. `loadDecodedBuffer` takes an `AudioBuffer` directly. `load('', peaks, duration)` takes pre-extracted `Float32Array` peaks.
   - What's unclear: Which is preferred for this use case in the current v7.12.3 release.
   - Recommendation: Use `loadDecodedBuffer(audioBuffer)` — it is the higher-level API and avoids manually extracting peaks. Simpler code.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — wavesurfer.js v7 API, version confirmations, `loadDecodedBuffer` pattern
- `.planning/research/ARCHITECTURE.md` — two-decode strategy, Zustand store shape, component build order
- `.planning/research/PITFALLS.md` — destroy-before-reload requirement, ArrayBuffer detach, large-file guard
- `.planning/PROJECT.md` — WebM/Opus confirmed, magic bytes `1a 45 df a3` confirmed
- `src/services/ffmpeg.ts` — existing singleton pattern (reference for audioDecoder service pattern)
- `package.json` — confirmed installed versions: wavesurfer.js@^7.12.3, zustand@^5.0.12, React 19, TypeScript 5.9

### Secondary (MEDIUM confidence)
- wavesurfer.js official docs (wavesurfer.xyz) — `loadDecodedBuffer` API confirmed in v7 docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions confirmed from package.json
- Architecture: HIGH — derived from pre-existing ARCHITECTURE.md (sourced from official docs) plus confirmed project structure
- Pitfalls: HIGH — sourced from pre-existing PITFALLS.md with GitHub issue citations; Phase 1 format results eliminate the highest-risk pitfall (format ambiguity)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable libraries; wavesurfer.js API unlikely to change at patch level)
