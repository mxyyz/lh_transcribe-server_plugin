/**
 * transcribe-server STT backend — registers the streaming WebSocket protocol
 * of a self-hosted transcribe-server (https://github.com/shaba/transcribe-server)
 * as a native dictation backend (host contract: registerSttBackend).
 *
 * Wire protocol (server endpoint: wss://<host>/v1/audio/stream):
 *   client → {"type":"start","model"?:<alias>,"language"?:<alpha-2>}  (text frame)
 *   client → binary PCM16LE mono 16 kHz frames, whole samples per frame
 *   client → {"type":"stop"}                                          (text frame)
 *   server → {"type":"partial","text":...} per drained chunk (VAD/chunk window)
 *   server → {"type":"final","text":...} at stop (all partials + remainder)
 *   server → {"type":"error","message":...} on protocol/server failures
 *
 * The host's pcm-capture worklet already emits PCM16LE mono 16 kHz in
 * 2048-sample frames — exactly this wire format — so audio passes through
 * unchanged. Keyless by design: the homelab server runs without --api-key.
 */

export const BACKEND_ID = 'transcribe-server';

/** Dictation language → transcribe-server's alpha-2 form: "multi" means
 *  auto-detect (field omitted); locale codes reduce to the primary subtag
 *  ("en-GB" → "en", "zh-Hans" → "zh"). */
export function toAlpha2(language) {
  if (language === 'multi') return undefined;
  return String(language).split('-')[0].toLowerCase();
}

/** The start frame sent on socket open. */
export function startFrame({ model, language }) {
  const start = { type: 'start' };
  if (model) start.model = model;
  const lang = toAlpha2(language);
  if (lang) start.language = lang;
  return JSON.stringify(start);
}

export const STOP_FRAME = JSON.stringify({ type: 'stop' });

/** Parse one server text frame into the host's normalized event, or null. */
export function parseMessage(data) {
  let msg;
  try { msg = JSON.parse(data); } catch { return null; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
  switch (msg.type) {
    case 'partial':
      return typeof msg.text === 'string' ? { partial: msg.text } : null;
    case 'final':
      return typeof msg.text === 'string' && msg.text ? { final: msg.text } : null;
    case 'error':
      return { error: typeof msg.message === 'string' && msg.message ? msg.message : 'transcribe-server error' };
    default:
      return null;
  }
}

/** Host adapter entry point: describe this backend's connection. */
export function connect({ url, model, language }) {
  return {
    url,
    startFrames: [startFrame({ model, language })],
    // PCM16LE mono 16 kHz passthrough — the worklet's native format.
    encodeAudio: frame => frame,
    parseMessage,
    stopFrame: STOP_FRAME,
  };
}

export function activate(context) {
  context.registerSttBackend({
    id: BACKEND_ID,
    label: 'transcribe-server',
    description: 'Streaming transcription over WebSocket from a self-hosted transcribe-server endpoint (wss://host/v1/audio/stream).',
    connect,
  });
}
