// Klang aus dem Synthesizer: Effekte und eine kleine Hintergrundmelodie (WebAudio, keine Dateien).
let ctx = null, master = null, fxBus = null, musBus = null, noiseBuf = null;
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
  apply();
}
function tone(f, dur, type, vol, slide, at, bus) {
  const t = at || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(bus || fxBus); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, freq, q, slide, at) {
  const t = at || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur); f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(fxBus); s.start(t); s.stop(t + dur + .02);
}
const LAST = {};
export function sfx(name, v) {
  if (!ctx || mode < 1) return;
  const now = ctx.currentTime;
  if (LAST[name] && now - LAST[name] < .035) return;   // nicht dutzendfach pro Moment
  LAST[name] = now;
  v = v == null ? 1 : v;
  switch (name) {
    case 'click': tone(520, .07, 'triangle', .22 * v, 380); break;
    case 'back': tone(380, .08, 'triangle', .2 * v, 260); break;
    case 'hit': tone(190, .09, 'square', .16 * v, 90); noise(.06, .22 * v, 1800, 1); break;
    case 'hit2': tone(130, .16, 'square', .22 * v, 55); noise(.12, .32 * v, 900, .8, 300); tone(420, .05, 'triangle', .1 * v); break;
    case 'boom': noise(.45, .5 * v, 500, .7, 90); tone(90, .4, 'sine', .4 * v, 35); break;
    case 'zap': noise(.25, .35 * v, 3000, 2, 600); tone(900, .18, 'sawtooth', .12 * v, 120); break;
    case 'die': noise(.6, .45 * v, 700, .8, 80); tone(300, .55, 'sawtooth', .2 * v, 50); tone(600, .12, 'triangle', .12 * v, 900); break;
    case 'block': tone(1200, .09, 'triangle', .18 * v, 800); noise(.04, .12 * v, 4000, 3); break;
    case 'heal': tone(660, .12, 'sine', .14 * v); tone(880, .16, 'sine', .12 * v, null, ctx.currentTime + .08); break;
    case 'stun': tone(700, .2, 'triangle', .14 * v, 350); break;
    case 'dash': noise(.25, .3 * v, 900, 1, 3500); break;
    case 'whoosh': noise(.5, .3 * v, 500, .8, 2500); break;
    case 'nova': noise(.7, .5 * v, 300, .6, 2200); tone(70, .7, 'sine', .45 * v, 200); break;
    case 'pop': tone(500, .09, 'sine', .22 * v, 900); break;
    case 'coin': tone(988, .08, 'square', .1 * v); tone(1319, .22, 'square', .1 * v, null, now + .07); break;
    case 'tick': tone(800, .05, 'square', .12 * v); break;
    case 'go': tone(523, .12, 'square', .14 * v); tone(784, .3, 'square', .14 * v, null, now + .1); break;
    case 'open': tone(330, .5, 'triangle', .2 * v, 880); noise(.3, .2 * v, 1500, 1, 4000); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => { tone(f, .22, 'triangle', .2 * v, null, now + i * .11); tone(f * 2, .2, 'sine', .06 * v, null, now + i * .11); }); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, .3, 'triangle', .18 * v, f * .96, now + i * .16)); break;
    case 'rare': [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, .3, 'sine', .14 * v, null, now + i * .08)); break;
    case 'legend': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, .5, 'triangle', .18 * v, null, now + i * .1); tone(f * 2, .45, 'sine', .07 * v, null, now + i * .1); }); break;
  }
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
