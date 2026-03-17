# WebP Trimmer

A browser-based audio trimmer for WebM files. Load a `.webm` recording, visualize its waveform, select a time range, and export the trimmed clip -- all without uploading anything to a server.

Built with React, FFmpeg.wasm (runs entirely in the browser), and WaveSurfer.js for waveform rendering.

## Features

- Drag-and-drop or file-picker loading of `.webm` audio files
- Interactive waveform display with draggable trim region
- Precise start/end time controls
- Estimated output size before trimming
- Stream-copy trimming via FFmpeg.wasm (fast, no re-encoding)
- One-click download of the trimmed `.webm` file
- Fully client-side -- no data leaves your browser

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
git clone <repo-url>
cd webp-trimmer
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Open it in a Chromium-based browser (Chrome, Edge, Brave) for best compatibility.

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

The output goes to `dist/`. When deploying, the hosting server **must** set these headers for FFmpeg.wasm to work:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Usage

1. Click **Open file** or drag a `.webm` file onto the page.
2. The waveform renders and a trim region appears.
3. Drag the region handles or use the time inputs to set start and end times.
4. Click **Trim** to process the file.
5. Click **Download** to save the trimmed clip.

## Limitations

- **WebM only** -- other containers (MP4, WAV, OGG, etc.) are not supported. The file must have WebM magic bytes (`1A 45 DF A3`).
- **130 MB file size limit** -- larger files are rejected to stay within browser memory constraints.
- **Chromium browsers required** -- FFmpeg.wasm relies on `SharedArrayBuffer`, which requires COOP/COEP headers. Firefox and Safari may work with the right server config but are not tested.
- **Stream copy only** -- trimming uses `-c copy`, so cut points snap to the nearest keyframe. This means the actual start/end may differ slightly from what you selected.
- **No video track handling** -- if the `.webm` contains video, only the audio track is exported.

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev server and bundling
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) for in-browser trimming
- [WaveSurfer.js](https://wavesurfer.xyz/) for waveform visualization
- [Zustand](https://zustand.docs.pmnd.rs/) for state management

## Future Work

- Support additional audio formats (MP3, OGG, WAV)
- Re-encode mode for frame-accurate trimming
- Multiple trim regions / batch export
- Mobile-friendly layout
- Drag-and-drop file loading
- Progress indicator during FFmpeg loading

## License

Private project -- not licensed for distribution.
