# WebP Trimmer

## What This Is

A browser-based tool for trimming WebP files that contain audio. Users load a WebP file, visually select a portion of the audio timeline to keep (trimming from the start and/or end), preview the result, and download the trimmed file — all client-side with no server.

## Core Value

Users can quickly trim the duration of a WebP audio file in the browser and save a smaller version without leaving the page or uploading to a server.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Load WebP files with audio via file picker or drag-and-drop
- [ ] Display audio waveform visualization of the loaded file
- [ ] Trim from start and/or end using draggable waveform handles
- [ ] Manual numeric inputs for precise trim points (seconds to cut from start/end)
- [ ] Play/preview the trimmed audio before saving
- [ ] Save/download the trimmed file as WebP
- [ ] Show file size before and after trimming
- [ ] Runs entirely client-side (no server, no uploads)

### Out of Scope

- Image compression or quality adjustment — this is duration trimming only
- Format conversion (MP3, WAV, etc.) — output stays WebP
- Video editing or frame manipulation — audio timeline trimming only
- Server-side processing — everything runs in the browser
- Mobile-optimized UI — desktop browser is the primary target

## Context

WebP files can contain audio data (similar to WebM containers). The tool needs to parse the WebP container format, extract audio, render a waveform, allow trimming, and re-encode back to WebP. FFmpeg compiled to WASM (e.g., ffmpeg.wasm) is the likely approach for client-side audio processing in the browser.

## Constraints

- **Runtime**: Pure client-side — no backend, no file uploads
- **Output format**: Must output valid WebP files (not convert to other formats)
- **Browser APIs**: Must work in modern browsers (Chrome, Firefox, Safari)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only | Privacy, simplicity, no hosting costs | Confirmed |
| Container format: WebM (not WebP) | ffprobe confirms `format_name=matroska,webm`; magic bytes `1a 45 df a3` (EBML header). Input files have `.webm` extension. Output format is `.webm`, MIME type `audio/webm`. | Confirmed in Phase 1 |
| Audio codec: Opus | ffprobe reports `codec_name=opus`, `codec_type=audio`, 48000 Hz mono, encoder=Chrome. ffmpeg trim flag: `-c:a libopus` | Confirmed in Phase 1 |
| Waveform + numeric inputs | Visual for quick trimming, numbers for precision | — Pending Phase 2 |

## Format Validation Results

### Summary

- **Container format:** `matroska,webm` (WebM / Matroska)
- **Audio codec:** `opus` (Opus Interactive Audio Codec)
- **Sample rate:** 48000 Hz
- **Channels:** 1 (mono)
- **Encoder:** Chrome
- **File size:** 258,083 bytes (~252 KB)
- **Magic bytes:** `1a 45 df a3` (EBML header — confirms WebM container)

### Downstream Implications

- Output file extension: `.webm` (not `.webp`)
- Output MIME type: `audio/webm`
- ffmpeg output container flag: `-f webm`
- ffmpeg audio codec flag: `-c:a libopus`
- `AudioContext.decodeAudioData` natively supports WebM/Opus in all modern browsers — two-decode strategy (Web Audio API for waveform, ffmpeg.wasm for trim) is confirmed viable

### ffprobe JSON Output (verbatim)

```json
{
    "streams": [
        {
            "index": 0,
            "codec_name": "opus",
            "codec_long_name": "Opus (Opus Interactive Audio Codec)",
            "codec_type": "audio",
            "codec_tag_string": "[0][0][0][0]",
            "codec_tag": "0x0000",
            "sample_fmt": "fltp",
            "sample_rate": "48000",
            "channels": 1,
            "channel_layout": "mono",
            "bits_per_sample": 0,
            "initial_padding": 0,
            "r_frame_rate": "0/0",
            "avg_frame_rate": "0/0",
            "time_base": "1/1000",
            "start_pts": 0,
            "start_time": "0.000000",
            "extradata_size": 19,
            "disposition": {
                "default": 1,
                "dub": 0,
                "original": 0,
                "comment": 0,
                "lyrics": 0,
                "karaoke": 0,
                "forced": 0,
                "hearing_impaired": 0,
                "visual_impaired": 0,
                "clean_effects": 0,
                "attached_pic": 0,
                "timed_thumbnails": 0,
                "non_diegetic": 0,
                "captions": 0,
                "descriptions": 0,
                "metadata": 0,
                "dependent": 0,
                "still_image": 0,
                "multilayer": 0
            },
            "tags": {
                "language": "eng"
            }
        }
    ],
    "format": {
        "filename": "/Users/nousunio/Repos/Learnings/claude-code/webp-trimmer/src/sample/sample.webm",
        "nb_streams": 1,
        "nb_programs": 0,
        "nb_stream_groups": 0,
        "format_name": "matroska,webm",
        "format_long_name": "Matroska / WebM",
        "start_time": "0.000000",
        "size": "258083",
        "probe_score": 100,
        "tags": {
            "encoder": "Chrome"
        }
    }
}
```

### Magic Bytes (xxd output)

```
00000000: 1a45 dfa3 9f42 8681 0142 f781 0142 f281  .E...B...B...B..
00000010: 0442 f381 0842 8284 7765 626d 4287 8104  .B...B..webmB...
```

EBML header `1a 45 df a3` confirms WebM container (not RIFF/WebP which would start with `52 49 46 46`).

---
*Last updated: 2026-03-16 — format decision confirmed by ffprobe (Task 2, Plan 01-02)*
