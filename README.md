# transcribe-server-stt

A [LearnHarness](https://github.com/amosblomqvist/learnharness) plugin that
adds a native dictation backend for a self-hosted
[transcribe-server](https://github.com/shaba/transcribe-server) (Rust,
OpenAI-compatible STT on top of transcribe.cpp — GigaAM / Whisper / Parakeet /
Voxtral GGUF models). It lives in its own repository and is installed into
LearnHarness like any external plugin.

The plugin registers one streaming WebSocket STT backend
(`transcribe-server`) through the host's `registerSttBackend` contract and
speaks the server's `/v1/audio/stream` protocol:

- client → `{"type":"start","model"?,"language"?}` text frame on open
- client → binary PCM16LE mono 16 kHz frames (the capture worklet's native
  format, passed through unchanged)
- client → `{"type":"stop"}` on stop
- server → `{"type":"partial","text"}` per drained chunk, `{"type":"final","text"}`
  at stop, `{"type":"error","message"}` on failures

## Usage

1. Run transcribe-server locally, e.g.
   `transcribe-server -m /models/voxtral.gguf` (keyless by default; no
   `--api-key` needed).
2. Install this plugin into LearnHarness (see below), then enable it in
   Settings → Plugins (plugins start disabled until explicitly enabled).
3. Settings → Dictation: set Provider to **Self-hosted (WebSocket)**, Backend
   to **transcribe-server**, and Stream URL to e.g.
   `wss://stt.homelab.internal/v1/audio/stream` (the desktop app must trust
   the server's certificate — install the homelab CA in the system store).
   Model is optional (the server's default model alias is used when empty).
4. Dictate as usual. The final transcript is appended when you stop.

## Install into LearnHarness

From this repository:

```sh
npm ci
npm run install:local -- "<plugins-directory>"
```

`<plugins-directory>` is the directory shown in LearnHarness under Settings →
Plugins. The installer bundles `src/main.js` into `dist/` and copies the
built package there. Restart LearnHarness to load it, then enable the
plugin. Alternatively, copy the built `dist/` contents into
`<plugins-directory>/transcribe-server-stt/dist/` yourself.

## Development

- `npm run build` — bundle `src/main.js` into `dist/` (esbuild).
- `npm test` — protocol unit tests (`tests/protocol.test.cjs`).
