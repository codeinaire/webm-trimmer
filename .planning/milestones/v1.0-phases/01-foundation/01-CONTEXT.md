# Phase 1: Foundation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Confirm the actual container format of "WebP with audio" files, scaffold the React + Vite + TypeScript project, and verify ffmpeg.wasm loads and executes a basic command in the browser. No feature code — this phase proves the technical foundation works.

</domain>

<decisions>
## Implementation Decisions

### Sample file source
- User will provide a real WebP-with-audio file for format validation
- Phase 1 spike must run ffprobe on this file to confirm whether it's WebP or WebM
- If the file turns out to be WebM, update PROJECT.md and OUT-01 requirement accordingly

### Deployment target
- Local app only — not deployed to any hosting service
- Single-threaded ffmpeg.wasm (`@ffmpeg/core`, not `@ffmpeg/core-mt`) is the correct choice
- No COOP/COEP header concerns since it runs locally

### Claude's Discretion
- Styling approach (Tailwind, CSS modules, or other — whatever fits best)
- Project folder structure and organization
- Exact Vite configuration beyond the mandatory `optimizeDeps.exclude` for ffmpeg.wasm
- Choice of state management library (Zustand recommended by research)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research findings
- `.planning/research/STACK.md` — Technology stack recommendations with versions and rationale
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, build order
- `.planning/research/PITFALLS.md` — Domain pitfalls with prevention strategies

### Project context
- `.planning/research/SUMMARY.md` — Synthesized research summary with phase implications
- `.planning/PROJECT.md` — Project vision, constraints, key decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- None — this is the first phase

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key outcome is confirming the file format and having a working ffmpeg.wasm setup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-16*
