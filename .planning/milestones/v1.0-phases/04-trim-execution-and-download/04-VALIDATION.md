---
phase: 4
slug: trim-execution-and-download
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.0 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | OUT-01 | unit | `npx vitest run src/services/ffmpeg.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | OUT-02 | unit | `npx vitest run src/utils/formatBytes.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | OUT-03 | unit | `npx vitest run src/store/trimStore.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | OUT-04 | unit | `npx vitest run src/store/trimStore.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/ffmpeg.test.ts` — stubs for OUT-01 (trimAudio Blob output, VFS cleanup calls)
- [ ] `src/utils/formatBytes.test.ts` — stubs for OUT-02 (size formatting at KB/MB boundary)
- [ ] `src/store/trimStore.test.ts` — stubs for OUT-03 (estimated size formula), OUT-04 (isProcessing guard)
- [ ] `src/utils/formatBytes.ts` — extract formatBytes utility for testability

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Downloaded file plays in media player | OUT-01 | Requires external player + human verification | Open trimmed .webm in VLC; verify duration matches trimmed region |
| Progress indicator visible during trim | OUT-04 | Visual UI state during async processing | Load file, set trim, click Trim — observe spinner/indicator |
| Real-time estimate updates during drag | OUT-03 | Requires mouse drag interaction | Drag handle slowly, observe estimated size updates continuously |
| Stale output clears on handle move | CONTEXT | UX interaction flow | Trim file, then move a handle — verify download disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
