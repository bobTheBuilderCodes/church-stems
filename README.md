# ChurchStem — Separate songs. Practice your part.

ChurchStem is a local-first web app that separates any song into six instrumental stems — **vocals, drums, bass, other, guitar, and piano** — using AI that runs entirely in your browser. No accounts, no cloud uploads, no backend server.

Designed for church musicians, worship teams, and instrumentalists who want to practice with specific parts removed or isolated.

## How it works

1. **Upload** a song (WAV, MP3, FLAC, OGG, or M4A).
2. **Separate** — the AI model splits it into six stems. The first run downloads the model (~136 MB, cached afterward).
3. **Mix** — mute, solo, and adjust volume on each stem independently.
4. **Export** — download a WAV file of your custom mix, or download individual stems / all stems as a ZIP.

## Technology

- **React + TypeScript + Vite** — frontend framework and build tool
- **Tailwind CSS** — styling
- **ONNX Runtime Web** — browser-based WASM inference for the HT-Demucs model
- **HT-Demucs 6-stem model** (`htdemucs_6s`) — pretrained model from [StemSplit/demucs-onnx](https://github.com/StemSplit/demucs-onnx), hosted on [Hugging Face](https://huggingface.co/StemSplitio/htdemucs-6s-onnx)
- **Web Audio API** — synchronized multi-stem playback and offline mix export
- **JSZip** — ZIP archive for downloading all stems

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/`.

### Internet access

The AI model (~136 MB) is downloaded from Hugging Face's CDN on first use. After that, your browser caches it — subsequent sessions load from cache without needing internet. All audio processing happens locally; your audio files never leave your device.

### Browser requirements

- A modern browser with WebAssembly SIMD support (Chrome 91+, Firefox 89+, Safari 15+)
- For best performance, multi-threaded WASM requires `SharedArrayBuffer`, which the dev server enables via COOP/COEP headers
- The model is large (~136 MB download, ~1 GB+ in memory during inference) — devices with 8 GB+ RAM are recommended
- Mobile devices will work but may be slow (5–10 seconds per 7.8-second chunk)

## Mute / Solo rules

- **Mute** silences a track. Muted tracks stay silent even if soloed.
- **Solo** isolates a track. When any track is soloed, only soloed (and non-muted) tracks are audible.
- Multiple tracks can be soloed simultaneously.
- **Volume** (0–100%) affects both live playback and the exported mix. 100% = original stem level.

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
src/
├── App.tsx                    — main application logic and state
├── types.ts                   — shared types and constants
├── lib/
│   ├── demucs.ts              — ONNX model loading and audio separation
│   └── audio.ts               — WAV encoding, mixing, decoding, formatting
├── hooks/
│   └── useAudioPlayback.ts    — synchronized multi-stem Web Audio playback
└── components/
    ├── UploadZone.tsx         — drag-and-drop file upload
    ├── ProcessingPanel.tsx    — separation progress UI
    ├── PlaybackControls.tsx   — play/pause/seek timeline
    ├── StemTrackControls.tsx  — per-stem mute/solo/volume/download
    └── ExportControls.tsx     — export mix, download all, reset
```

## License

MIT. The HT-Demucs model is from Meta/FAIR, exported to ONNX by [StemSplit](https://github.com/StemSplit/demucs-onnx).
