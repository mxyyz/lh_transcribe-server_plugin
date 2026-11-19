const assert = require('node:assert/strict');
const path = require('node:path');
const { test, before } = require('node:test');
const { buildSync } = require('esbuild');

const source = buildSync({
  entryPoints: [path.join(__dirname, '../src/main.js')],
  bundle: true, platform: 'browser', format: 'esm', write: false,
}).outputFiles[0].text;
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let BACKEND_ID, activate, connect, parseMessage, startFrame, toAlpha2, STOP_FRAME;
before(async () => {
  ({ BACKEND_ID, activate, connect, parseMessage, startFrame, toAlpha2, STOP_FRAME } = await import(moduleUrl));
});

test('activate registers the transcribe-server backend on the host context', () => {
  const registered = [];
  const context = { registerSttBackend: (backend) => { registered.push(backend); return () => {}; } };
  activate(context);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].id, BACKEND_ID);
  assert.equal(registered[0].id, 'transcribe-server');
  assert.equal(typeof registered[0].label, 'string');
  assert.equal(registered[0].connect, connect);
});

test('toAlpha2 maps multi to auto-detect and locales to the primary subtag', () => {
  assert.equal(toAlpha2('multi'), undefined);
  assert.equal(toAlpha2('en'), 'en');
  assert.equal(toAlpha2('en-GB'), 'en');
  assert.equal(toAlpha2('zh-Hans'), 'zh');
  assert.equal(toAlpha2('es-419'), 'es');
});

test('startFrame carries model and alpha-2 language only when set', () => {
  assert.deepEqual(JSON.parse(startFrame({ model: 'voxtral', language: 'en-GB' })), { type: 'start', model: 'voxtral', language: 'en' });
  assert.deepEqual(JSON.parse(startFrame({ language: 'multi' })), { type: 'start' });
  assert.deepEqual(JSON.parse(startFrame({ model: 'gigaam', language: 'ru' })), { type: 'start', model: 'gigaam', language: 'ru' });
});

test('parseMessage maps partial/final/error and ignores everything else', () => {
  assert.deepEqual(parseMessage('{"type":"partial","text":"hel"}'), { partial: 'hel' });
  assert.deepEqual(parseMessage('{"type":"final","text":"hello there"}'), { final: 'hello there' });
  assert.deepEqual(parseMessage('{"type":"error","message":"model not loaded"}'), { error: 'model not loaded' });
  assert.deepEqual(parseMessage('{"type":"error"}'), { error: 'transcribe-server error' });
  assert.equal(parseMessage('{"type":"stats"}'), null);
  assert.equal(parseMessage('not json'), null);
  assert.equal(parseMessage('{"type":"final","text":""}'), null);
});

test('connect returns the stream url, start frame, PCM passthrough and stop frame', () => {
  const conn = connect({ url: 'wss://stt.homelab.internal/v1/audio/stream', model: 'voxtral', language: 'en-US' });
  assert.equal(conn.url, 'wss://stt.homelab.internal/v1/audio/stream');
  assert.deepEqual(conn.startFrames, [JSON.stringify({ type: 'start', model: 'voxtral', language: 'en' })]);
  const frame = new ArrayBuffer(4096);
  assert.equal(conn.encodeAudio(frame), frame, 'PCM16LE frames pass through unchanged');
  assert.equal(conn.stopFrame, STOP_FRAME);
  assert.equal(JSON.parse(conn.stopFrame).type, 'stop');
  assert.equal(typeof conn.parseMessage, 'function');
  assert.equal(conn.protocols, undefined, 'keyless: no handshake subprotocols');
});
