# Phase 3: Trim Interaction - Research

**Researched:** 2026-03-16
**Domain:** wavesurfer.js v7 Regions plugin, Zustand bidirectional state sync, React controlled inputs, keyboard handle nudge
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- wavesurfer.js v7 with Regions plugin — already installed, provides drag handles out of the box
- Zustand single source of truth — region events push trimStart/trimEnd to store; numeric inputs read from store
- `trimStart`/`trimEnd` already stubbed in `trimStore.ts` (0 and duration on file load)
- Requirements specify "seconds to cut from start/end" as the numeric input model
- WaveformView currently has `interact: false` — Phase 3 enables interaction via Regions plugin

### Claude's Discretion
- Trim region visual treatment (colors, opacity, dimming of cut portions)
- Numeric input placement, formatting, and decimal precision
- Arrow key nudge step size (e.g., 0.1s default, Shift+arrow for larger jumps)
- Handle focus behavior and keyboard interaction model
- Layout of trim controls relative to waveform
- Validation UX for preventing invalid states (start > end)
- How "cut from start" / "cut from end" values are displayed vs internal trimStart/trimEnd representation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WAVE-02 | User can drag start/end handles on the waveform to set trim region | Regions plugin `addRegion({ drag: true, resize: true })` + `region.on('update-end')` pushes to store |
| WAVE-03 | User can type seconds to cut from start/end via numeric inputs | Controlled `<input type="number">` reads `trimStart`/`trimEnd` from store; onChange calls `setTrimStart`/`setTrimEnd` |
| WAVE-04 | Waveform handles and numeric inputs stay in bidirectional sync | Store is single source of truth; region events push to store; inputs read from store; store changes call `region.setOptions()` |
| WAVE-05 | User can nudge trim handles with keyboard arrow keys | `keydown` listener on focused handle element calls `region.setOptions()` with ±step increment |
</phase_requirements>

---

## Summary

Phase 3 enables interactive trim control by wiring the wavesurfer.js v7 Regions plugin to the existing Zustand store. The Regions plugin is already installed (wavesurfer.js 7.12.3) and provides draggable resize handles out of the box. The integration work splits into three parts: (1) register the Regions plugin in WaveformView, create a region spanning the full duration, and push `update-end` events into the store; (2) add `setTrimStart` / `setTrimEnd` actions to the store with clamping, and add a `useEffect` in WaveformView that calls `region.setOptions()` whenever store values change externally; (3) build a `TrimControls` component with two numeric inputs that read from and write to the store, with a keyboard handler for arrow-key nudging.

The most important technical finding is the bidirectional sync strategy. The wavesurfer Regions plugin and the numeric inputs must never fight for ownership. The pattern is: Regions plugin fires `update-end` → store is written → React re-renders inputs from store. When inputs change → store is written → `useEffect` on store values calls `region.setOptions()`. A `isSyncing` guard ref (or stable identity check) prevents the `useEffect` from re-triggering the region update after the region itself caused the store write.

The keyboard nudge requirement (WAVE-05) has no native support in the Regions plugin. It must be implemented as a `keydown` listener on a wrapper element or the region's DOM handle, calling `region.setOptions({ start/end })` and pushing to the store.

**Primary recommendation:** Register Regions plugin at wavesurfer init time, not in a separate effect. Keep a ref to both the plugin instance and the active region. Sync from region to store via `update-end`; sync from store to region via a guarded `useEffect`. All clamping logic lives in the store actions.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wavesurfer.js | 7.12.3 (installed) | Waveform rendering + Regions plugin for drag handles | Already integrated in Phase 2; Regions plugin bundled in same package |
| Regions plugin | bundled in wavesurfer.js | Draggable/resizable region overlay on waveform | Only wavesurfer sub-package needed; no extra install |
| Zustand | 5.0.12 (installed) | Single source of truth for trimStart/trimEnd | Already installed and used in Phase 2 |
| React | 19.2.4 (installed) | Controlled inputs and component rendering | Already the UI framework |

### No New Installs Required

All libraries needed for Phase 3 are already in `package.json`. No `npm install` step is needed.

---

## Architecture Patterns

### Recommended Component Structure for Phase 3

```
src/
├── components/
│   ├── WaveformView.tsx      # MODIFY: add RegionsPlugin, create region, sync store
│   └── TrimControls.tsx      # NEW: numeric inputs + keyboard handler
├── store/
│   └── trimStore.ts          # MODIFY: add setTrimStart / setTrimEnd with clamping
└── App.tsx                   # MODIFY: render <TrimControls /> below <WaveformView />
```

### Pattern 1: Regions Plugin Initialization

**What:** Register the Regions plugin during WaveSurfer.create() (not separately), then create the trim region once the waveform is loaded.

**When to use:** Any time you need a region immediately after waveform render.

**Why at create() time:** If you register after `WaveSurfer.create()`, there is a race condition between `wavesurfer.load()` completing and the plugin being ready to add regions.

```typescript
// Source: https://deepwiki.com/katspaugh/wavesurfer.js/4.1-regions-plugin
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

// Inside WaveformView useEffect, alongside WaveSurfer.create():
const wsRegions = RegionsPlugin.create()

const ws = WaveSurfer.create({
  container: containerRef.current,
  waveColor: '#4a9eff',
  progressColor: '#1a6fc4',
  height: 128,
  interact: true,          // CHANGE from false — required for region handles to work
  peaks: channelData,
  duration: audioBuffer.duration,
  plugins: [wsRegions],    // Register at creation time
})

// Create the trim region after load completes
ws.on('ready', () => {
  wsRegions.addRegion({
    id: 'trim',
    start: trimStart,        // from store
    end: trimEnd,            // from store (= duration on initial load)
    drag: false,             // whole-region drag is confusing for a trim tool — disable
    resize: true,            // start and end handles resize-only
    color: 'rgba(74, 158, 255, 0.15)',
  })
})
```

**Important:** Set `interact: true` on the WaveSurfer instance itself. The existing code has `interact: false`, which blocks ALL handle interaction including the Regions plugin handles.

### Pattern 2: Region-to-Store Sync (Region writes store)

**What:** Listen to the region's `update-end` event; push `region.start` and `region.end` to the Zustand store.

**When to use:** Whenever the user finishes a drag or resize interaction on the waveform handle.

**Why `update-end` not `update`:** `update` fires on every mouse-move pixel during drag — writing to React state this frequently causes excessive re-renders. `update-end` fires once when the user releases the mouse, giving clean discrete updates.

```typescript
// Source: https://deepwiki.com/katspaugh/wavesurfer.js/4.1-regions-plugin
const isSyncingFromStore = useRef(false)

wsRegions.on('region-updated', (region) => {
  if (isSyncingFromStore.current) return  // avoid feedback loop
  setTrimStart(region.start)
  setTrimEnd(region.end)
})
```

**Note on event name:** The confirmed v7 event name is `'region-updated'` (past tense) on the RegionsPlugin instance. The per-region event is `'update-end'`. Either works; prefer the plugin-level `'region-updated'` since it gives you the region object directly.

### Pattern 3: Store-to-Region Sync (Store writes region)

**What:** When `trimStart` or `trimEnd` changes in the store (due to numeric input), call `region.setOptions()` to move the waveform handle to match.

**When to use:** Any time numeric inputs change the store.

**Critical guard:** Without a guard, the `update-end` event causes a store write, which triggers this `useEffect`, which calls `setOptions`, which may re-fire the event — an infinite loop. Use a ref flag to break the cycle.

```typescript
// Source: region.setOptions confirmed from wavesurfer.js GitHub and DeepWiki docs
const regionRef = useRef<Region | null>(null)
const isSyncingFromStore = useRef(false)

useEffect(() => {
  if (!regionRef.current) return
  isSyncingFromStore.current = true
  regionRef.current.setOptions({ start: trimStart, end: trimEnd })
  // setOptions does not fire update-end, so we reset synchronously:
  isSyncingFromStore.current = false
}, [trimStart, trimEnd])
```

**TypeScript note:** The `setOptions` type definition required `start` in wavesurfer.js versions before 7.8.1 (fixed in PR #3972, merged Dec 2024). Since the installed version is 7.12.3, always include both `start` and `end` in `setOptions` calls to be safe and avoid type errors.

### Pattern 4: Bidirectional Numeric Inputs

**What:** Controlled `<input type="number">` components that display derived values and write back to the store.

**Representation:** The requirements specify "seconds to cut from start/end" — which is a derived view:

```
cutFromStart = trimStart                   (seconds from file start)
cutFromEnd   = duration - trimEnd          (seconds from file end)
```

Store values (`trimStart`, `trimEnd`) are absolute positions in seconds. Inputs display and set the "cut" amounts. Conversion happens at the input boundary.

```typescript
// TrimControls reads from store
const { trimStart, trimEnd, duration, setTrimStart, setTrimEnd } = useTrimStore()

const cutFromStart = trimStart
const cutFromEnd = duration - trimEnd

const handleCutFromStartChange = (value: number) => {
  const clamped = Math.max(0, Math.min(value, trimEnd - 0.01))
  setTrimStart(clamped)
}

const handleCutFromEndChange = (value: number) => {
  const newTrimEnd = duration - value
  const clamped = Math.max(trimStart + 0.01, Math.min(newTrimEnd, duration))
  setTrimEnd(clamped)
}
```

**Decimal precision:** Display 2 decimal places (0.01s resolution). The `step="0.01"` attribute on the input allows fine-grained native increment/decrement.

### Pattern 5: Keyboard Arrow Key Nudge

**What:** When a trim input is focused and the user presses ArrowLeft or ArrowRight, nudge the corresponding trim handle by a small step.

**Native behavior conflict:** `<input type="number">` already responds to arrow keys by incrementing/decrementing the value by `step`. This means WAVE-05 is satisfied automatically by setting `step="0.1"` (or similar) on the numeric inputs — the browser handles it without any custom `keydown` listener.

**Recommendation:** Use native `<input type="number" step="0.1">` behavior for the base nudge. Add `shift+arrow` = 1.0s nudge via `onKeyDown` handler on each input.

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, which: 'start' | 'end') => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  if (!e.shiftKey) return  // plain arrow: browser default handles 0.1s step

  e.preventDefault()
  const largeStep = 1.0  // seconds for Shift+arrow
  const delta = e.key === 'ArrowRight' ? largeStep : -largeStep

  if (which === 'start') {
    setTrimStart(Math.max(0, Math.min(trimStart + delta, trimEnd - 0.01)))
  } else {
    setTrimEnd(Math.max(trimStart + 0.01, Math.min(trimEnd + delta, duration)))
  }
}
```

**Note:** The success criterion says "handle is focused" and "handle moves" — the numeric input being focused and its store value changing is functionally equivalent. The waveform handle moves because the store drives `region.setOptions()`.

### Anti-Patterns to Avoid

- **Using `update` (not `update-end`) for store writes:** Fires on every pixel of drag, causing hundreds of React state updates and re-renders. Use `update-end` / `region-updated` for discrete commits.
- **Setting `interact: false` on WaveSurfer with Regions plugin active:** Blocks pointer events on the canvas. Regions plugin handles require `interact: true`.
- **Creating a new region on every `trimStart`/`trimEnd` store change:** One region should be created once and updated via `setOptions()`. Recreating causes visual flicker and handle position jumps.
- **Calling `setOptions()` without both `start` and `end`:** In the installed version (7.12.3), omitting `start` from `setOptions` may cause a TypeScript error (known issue, fixed after 7.8.1, but include both to be safe).
- **Storing wavesurfer/region refs in React state:** These are mutable non-serializable objects. Always use `useRef`, never `useState`, for wavesurfer/region instances.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Draggable waveform handles | Custom pointer-event drag system on a Canvas | Regions plugin (already installed) | Handles pointer capture, cursor feedback, resize-vs-drag disambiguation, touch events — 500+ lines of browser-compat code |
| Clamping start < end constraint | Complex bi-directional validation in two components | Store actions with `Math.max`/`Math.min` clamp at write time | Single enforcement point; components stay dumb |
| Input step/increment behavior | Custom keydown handler counting key presses | `<input type="number" step="0.1">` native browser behavior | Free, accessible, handles long-press repeat, compatible with screen readers |
| Display formatting (2dp) | Custom number formatter | `toFixed(2)` + `parseFloat` on input value | One-liner; no dependency needed |

---

## Common Pitfalls

### Pitfall 1: `interact: false` Blocks Regions Plugin Handles

**What goes wrong:** The Regions plugin adds DOM elements (handle divs) on top of the waveform canvas. If `interact: false` is set on WaveSurfer, pointer events on the entire waveform container are disabled, which prevents handle dragging.

**Why it happens:** Phase 2 intentionally set `interact: false` to prevent accidental waveform seeks. Phase 3 needs to re-enable interaction.

**How to avoid:** Change WaveSurfer option to `interact: true`. If waveform-click-to-seek is unwanted, prevent it by not calling `wavesurfer.seekTo()` and instead doing nothing on the waveform `click` event.

**Warning signs:** Region handles render but do not respond to mouse drag.

### Pitfall 2: Infinite Sync Loop Between Region and Store

**What goes wrong:** Region `update-end` → store update → `useEffect` triggers → `region.setOptions()` → region fires `update-end` again → loop.

**Why it happens:** `setOptions()` may internally fire the update event (behavior varies by wavesurfer version).

**How to avoid:** Use an `isSyncingFromStore` ref flag. Set it to `true` before `region.setOptions()`, reset it to `false` after. In the `region-updated` handler, bail early if the flag is set.

**Warning signs:** React warning about "Maximum update depth exceeded"; console logging shows the event firing repeatedly.

### Pitfall 3: "cut from start/end" vs Internal trimStart/trimEnd Representation Confusion

**What goes wrong:** The UI shows "cut 1.5s from start" but the store tracks `trimStart = 1.5`. These are the same value. The "cut from end" input shows `duration - trimEnd`. If this conversion is not consistent, inputs show wrong values or introduce drift.

**Why it happens:** The requirements say "seconds to cut from start/end" but the natural internal model is absolute seconds. The conversion is simple but must happen at exactly one boundary.

**How to avoid:** Do the conversion only at the `TrimControls` component boundary (display: convert store→input; onChange: convert input→store). The store always holds absolute seconds.

### Pitfall 4: Region Created Before Waveform Is Ready

**What goes wrong:** Calling `wsRegions.addRegion()` immediately after `WaveSurfer.create()` (before `wavesurfer.load()` completes) may fail silently or create a region with zero-width because the duration is not yet known to the renderer.

**Why it happens:** `wavesurfer.load()` with pre-decoded peaks is async; the canvas is not yet sized.

**How to avoid:** Add the region inside the `wavesurfer.on('ready', ...)` callback, which fires after the waveform has been fully drawn and the duration is set.

### Pitfall 5: setTrimStart/setTrimEnd Actions Not in Store Yet

**What goes wrong:** The store has `trimStart`/`trimEnd` fields but no setter actions for them (Phase 2 stubbed only `setAudioBuffer` which initializes `trimEnd`). Attempting to call `setTrimStart()` will throw a TypeScript error.

**Why it happens:** Phase 2 deferred Phase 3 store actions intentionally. They must be added before any Phase 3 component can work.

**How to avoid:** First task of Phase 3 is adding `setTrimStart(n: number)` and `setTrimEnd(n: number)` actions to `trimStore.ts` with clamping logic.

---

## Code Examples

Verified patterns from official sources and confirmed API:

### Regions Plugin Init Pattern (complete WaveformView sketch)

```typescript
// Source: https://deepwiki.com/katspaugh/wavesurfer.js/4.1-regions-plugin
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useRef, useEffect } from 'react'
import { useTrimStore } from '../store/trimStore'

export function WaveformView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<Region | null>(null)
  const isSyncingFromStore = useRef(false)

  const audioBuffer = useTrimStore((s) => s.audioBuffer)
  const trimStart = useTrimStore((s) => s.trimStart)
  const trimEnd = useTrimStore((s) => s.trimEnd)
  const { setTrimStart, setTrimEnd } = useTrimStore()

  // Effect 1: Initialize wavesurfer + regions when audioBuffer changes
  useEffect(() => {
    if (!containerRef.current || !audioBuffer) return

    wsRef.current?.destroy()

    const channelData: Float32Array[] = []
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i))
    }

    const wsRegions = RegionsPlugin.create()

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a9eff',
      progressColor: '#1a6fc4',
      height: 128,
      interact: true,          // changed from false
      plugins: [wsRegions],
    })

    void wsRef.current.load('', channelData, audioBuffer.duration)

    wsRef.current.on('ready', () => {
      const region = wsRegions.addRegion({
        id: 'trim',
        start: trimStart,
        end: trimEnd,
        drag: false,
        resize: true,
        color: 'rgba(74, 158, 255, 0.15)',
      })
      regionRef.current = region

      // Region drag finished -> push to store
      wsRegions.on('region-updated', (r) => {
        if (isSyncingFromStore.current) return
        setTrimStart(r.start)
        setTrimEnd(r.end)
      })
    })

    return () => {
      wsRef.current?.destroy()
      wsRef.current = null
      regionRef.current = null
    }
  }, [audioBuffer])   // intentionally excludes trimStart/trimEnd — they are synced via effect 2

  // Effect 2: External store changes -> update region handle position
  useEffect(() => {
    if (!regionRef.current) return
    isSyncingFromStore.current = true
    regionRef.current.setOptions({ start: trimStart, end: trimEnd })
    isSyncingFromStore.current = false
  }, [trimStart, trimEnd])

  // ...render
}
```

### Store Actions Addition

```typescript
// Add to trimStore.ts TrimStore interface:
setTrimStart: (n: number) => void
setTrimEnd: (n: number) => void

// Add to create() body:
setTrimStart: (n) =>
  set((s) => ({ trimStart: Math.max(0, Math.min(n, s.trimEnd - 0.01)) })),
setTrimEnd: (n) =>
  set((s) => ({ trimEnd: Math.max(s.trimStart + 0.01, Math.min(n, s.duration)) })),
```

### TrimControls Component Sketch

```typescript
// Source: React controlled input pattern + "cut from start/end" conversion
import { useTrimStore } from '../store/trimStore'

export function TrimControls() {
  const { trimStart, trimEnd, duration, setTrimStart, setTrimEnd } = useTrimStore()

  // display values: "seconds cut" from each side
  const cutFromStart = trimStart
  const cutFromEnd = duration - trimEnd

  return (
    <div className="trim-controls">
      <label>
        Cut from start (s)
        <input
          type="number"
          min={0}
          max={parseFloat((trimEnd - 0.01).toFixed(2))}
          step={0.1}
          value={cutFromStart.toFixed(2)}
          onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => {
            if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault()
              const delta = e.key === 'ArrowRight' ? 1.0 : -1.0
              setTrimStart(trimStart + delta)
            }
          }}
        />
      </label>
      <label>
        Cut from end (s)
        <input
          type="number"
          min={0}
          max={parseFloat((duration - trimStart - 0.01).toFixed(2))}
          step={0.1}
          value={cutFromEnd.toFixed(2)}
          onChange={(e) => {
            const cutVal = parseFloat(e.target.value) || 0
            setTrimEnd(duration - cutVal)
          }}
          onKeyDown={(e) => {
            if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault()
              const delta = e.key === 'ArrowRight' ? 1.0 : -1.0
              setTrimEnd(trimEnd + delta)
            }
          }}
        />
      </label>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| wavesurfer v6: `wavesurfer.addRegion()` on instance | v7: `RegionsPlugin.create()` registered via `plugins: []` | wavesurfer v7 (2023) | Plugin must be initialized as a plugin, not called on the wavesurfer instance |
| v6: `region-update-end` event (hyphenated) | v7: `region-updated` on RegionsPlugin; `update-end` on Region instance | wavesurfer v7 | Event names changed; old community examples with `region-update-end` are v6 |
| `setOptions()` required `start` param always | Fixed in PR #3972 (Dec 2024, merged in 7.8+) | Dec 2024 | v7.12.3 (installed) may still need both `start` and `end` in `setOptions` for safety |
| `wavesurfer.regions.list` to access regions | `regionsPlugin.getRegions()` | wavesurfer v7 | Direct instance access removed; go through plugin ref |

**Deprecated/outdated patterns to avoid:**

- `wavesurfer.addRegion()` — v6 API, does not exist in v7
- `region-update-end` as event name on v7 wavesurfer instance — v6 event name; use `region-updated` on the plugin
- Reading `wavesurfer.regions` directly — replaced by the plugin ref returned from `RegionsPlugin.create()`

---

## Open Questions

1. **Does `region.setOptions()` in 7.12.3 fire `region-updated` on the plugin?**
   - What we know: The installed version is 7.12.3. The `setOptions` fix was merged Dec 2024 into PR #3972. The behavior of whether setOptions re-fires the update event is not confirmed from official docs.
   - What's unclear: If `setOptions()` fires `region-updated`, the `isSyncingFromStore` ref guard is mandatory. If it doesn't, the guard is unnecessary but harmless.
   - Recommendation: Include the guard unconditionally. It is a two-line safety mechanism.

2. **Does setting `interact: true` re-enable waveform click-to-seek?**
   - What we know: `interact: false` in WaveSurfer disables click-to-seek AND all plugin pointer events. `interact: true` enables both.
   - What's unclear: Whether click-to-seek is wanted in Phase 3. Seeking does not interfere with trim state, but could confuse users.
   - Recommendation: Leave seek enabled — it does not conflict with trim interaction, and playback is out of scope for Phase 3 anyway.

---

## Sources

### Primary (HIGH confidence)
- [wavesurfer.js Regions Plugin DeepWiki](https://deepwiki.com/katspaugh/wavesurfer.js/4.1-regions-plugin) — Plugin init pattern, `addRegion()` params, `region-updated` event
- [wavesurfer.js Regions Plugin official docs](https://wavesurfer.xyz/docs/classes/plugins_regions.default) — `RegionsPlugin.create()`, `getRegions()`, events list
- [wavesurfer.js regions.d.ts type definitions](https://app.unpkg.com/wavesurfer.js@7.8.1/files/dist/plugins/regions.d.ts) — `setOptions()` signature, `update`/`update-end` event names on Region
- [GitHub issue #3873 — setOptions TypeScript type error](https://github.com/katspaugh/wavesurfer.js/issues/3873) — Confirmed `start` was required in setOptions, fixed in PR #3972 (Dec 2024)
- Existing project files: `src/store/trimStore.ts`, `src/components/WaveformView.tsx`, `package.json` — current implementation state

### Secondary (MEDIUM confidence)
- [GitHub regions.js raw example](https://raw.githubusercontent.com/katspaugh/wavesurfer.js/main/examples/regions.js) — `addRegion()` usage, `region.setOptions()` confirmed
- [wavesurfer.js official examples page](https://wavesurfer.xyz/examples/) — regions plugin listed, code patterns referenced

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new installs; versions confirmed in package.json
- Architecture: HIGH — bidirectional sync pattern confirmed; event names verified from type definitions and DeepWiki; `setOptions()` confirmed from GitHub examples
- Pitfalls: HIGH — `interact: false` issue is directly observable from current code; sync loop risk is confirmed by research; store action absence is visible in trimStore.ts
- Keyboard nudge: HIGH — native `<input type="number" step>` behavior is well-established; `setOptions()` path for Shift+arrow confirmed

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (wavesurfer.js v7 is stable; Zustand 5 is stable; no imminent breaking changes expected)
