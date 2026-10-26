// Klang: Effekte sind KI-erzeugte Samples (public/audio), die Hintergrundmusik kommt aus dem WebAudio-Synthesizer.
let ctx = null, master = null, fxBus = null, musBus = null, noiseBuf = null;   // noiseBuf: Rauschen für die Hi-Hat der Musik
let mode = 2;                  // 0 = aus, 1 = nur Effekte, 2 = Effekte und Musik
let scene = 'menu', timer = 0, nextT = 0, step = 0;
try { const v = window.localStorage.getItem('bvb_snd'); if (v !== null) mode = Math.max(0, Math.min(2, +v)); } catch (e) { }

export const getMode = () => mode;
export function setMode(m) {
  mode = m; try { window.localStorage.setItem('bvb_snd', String(m)); } catch (e) { }
  apply();
}
function apply() {
  if (!ctx) return;
  fxBus.gain.value = mode >= 1 ? 1 : 0;
  musBus.gain.value = mode >= 2 ? 1 : 0;
  if (mode >= 2) startMusic(); else stopMusic();
}
export function unlock() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
      fxBus = ctx.createGain(); fxBus.connect(master); musBus = ctx.createGain(); musBus.gain.value = .5; musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; return; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  loadSamples();
  apply();
}
function tone(f, dur, type, vol, slide, at, bus) {
  const t = at || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(bus || fxBus); o.start(t); o.stop(t + dur + .02);
}
/* ---------- Effekte: KI-erzeugte Samples (ElevenLabs Sound Effects, siehe public/audio) ---------- */
const SFX_NAMES = ['click', 'back', 'hit', 'tick', 'hit2', 'boom', 'zap', 'die', 'block', 'heal', 'stun', 'dash', 'whoosh', 'nova', 'pop', 'coin', 'go', 'open', 'win', 'lose', 'rare', 'legend'];
const VARY = { hit: .06, hit2: .05, click: .04, pop: .06, tick: .03, block: .05, zap: .05, coin: .02 };   // leichte Tonhöhen-Schwankung, damit sich Wiederholungen nicht gleich anhören
const buffers = {};
let loading = false;
function loadSamples() {
  if (loading || !ctx) return;
  loading = true;
  for (const n of SFX_NAMES) {
    fetch('/audio/' + n + '.mp3').then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))).then(buf => { buffers[n] = buf; }).catch(() => { });
  }
}
const LAST = {};
export function sfx(name, v) {
  if (!ctx || mode < 1) return;
  const buf = buffers[name]; if (!buf) return;
  const now = ctx.currentTime;
  if (LAST[name] && now - LAST[name] < .035) return;   // nicht dutzendfach pro Moment
  LAST[name] = now;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = 1 + (VARY[name] ? (Math.random() - .5) * 2 * VARY[name] : 0);
  g.gain.value = (v == null ? 1 : v) * .9;
  src.connect(g); g.connect(fxBus); src.start(now);
}

/* ---------- Musik ---------- */
const SCALE = [0, 2, 4, 7, 9];              // Dur-Pentatonik
const hz = (n) => 261.63 * Math.pow(2, n / 12);
const BASS = [0, 0, -5, -5, -3, -3, -7, -7];   // Grundtöne je Takt (Halbtöne)
function bar(t, b, sc) {
  const sp = 60 / (sc === 'fight' ? 132 : 96) / 2;   // Achtel
  const root = BASS[b % 8];
  for (let i = 0; i < 8; i++) {
    const tt = t + i * sp;
    if (i % 2 === 0) tone(hz(root - 12), sp * 1.6, 'triangle', sc === 'fight' ? .2 : .14, null, tt, musBus);
    const deg = SCALE[(i * 3 + b * 2) % 5] + (i % 4 === 3 ? 12 : 0);
    if (sc === 'fight' || i % 2 === 1) tone(hz(root + deg), sp * 1.4, 'sine', sc === 'fight' ? .13 : .1, null, tt, musBus);
    if (sc === 'fight') {
      if (i % 4 === 0) tone(110, .1, 'sine', .3, 45, tt, musBus);
      if (i % 4 === 2) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 5000; g.gain.setValueAtTime(.09, tt); g.gain.exponentialRampToValueAtTime(.0005, tt + .06); s.connect(f); f.connect(g); g.connect(musBus); s.start(tt); s.stop(tt + .08); }
    }
  }
  return sp * 8;
}
function tickMusic() {
  if (!ctx || mode < 2) return;
  while (nextT < ctx.currentTime + .6) {
    if (nextT < ctx.currentTime - .1) nextT = ctx.currentTime + .05;
    nextT += bar(nextT, step++, scene);
  }
}
function startMusic() { if (timer || !ctx) return; nextT = ctx.currentTime + .1; step = 0; timer = setInterval(tickMusic, 200); }
function stopMusic() { clearInterval(timer); timer = 0; }
export function setScene(s) { scene = s; }
