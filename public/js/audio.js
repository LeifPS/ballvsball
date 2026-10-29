// Klang: Effekte und Musik sind KI-erzeugte Aufnahmen (public/audio, ElevenLabs), abgespielt über WebAudio.
let ctx = null, master = null, fxBus = null, musBus = null;
let mode = 2;                  // 0 = aus, 1 = nur Effekte, 2 = Effekte und Musik
let scene = 'menu';
try { const v = window.localStorage.getItem('bvb_snd'); if (v !== null) mode = Math.max(0, Math.min(2, +v)); } catch (e) { }

export const getMode = () => mode;
export const hasSfx = n => !!buffers[n];   // Datei geladen? (sonst spielt der Ersatzton)
export function setModeTemp(m) { mode = m; apply(); }   // ohne zu speichern (Vorschauseiten)
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
    } catch (e) { ctx = null; return; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  loadSamples();
  apply();
}
/* ---------- Effekte: KI-erzeugte Samples (ElevenLabs Sound Effects, siehe public/audio) ---------- */
const SFX_NAMES = ['drop_tap', 'drop_up', 'drop_charge', 'drop_shatter', 'skin_kosmos_cast', 'skin_kosmos_hit', 'skin_kosmos_start', 'skin_kosmos_die', 'click', 'back', 'hit', 'tick', 'hit2', 'boom', 'zap', 'die', 'block', 'heal', 'stun', 'dash', 'whoosh', 'nova', 'pop', 'coin', 'go', 'open', 'win', 'lose', 'rare', 'legend', 'helper', 'grow', 'mute', 'mood', 'bombdrop', 'shield', 'boing', 'cannon', 'grate', 'catch', 'mythic'];
const VARY = { hit: .06, hit2: .05, click: .04, pop: .06, tick: .03, block: .05, zap: .05, coin: .02 };   // leichte Tonhöhen-Schwankung, damit sich Wiederholungen nicht gleich anhören
const buffers = {};
let loading = false;
function loadSamples() {
  if (loading || !ctx) return;
  loading = true;
  for (const n of SFX_NAMES) {
    fetch('/audio/' + n + '.mp3').then(r => { if (!r.ok) throw new Error('fehlt'); return r.arrayBuffer(); }).then(ab => ctx.decodeAudioData(ab)).then(buf => { buffers[n] = buf; }).catch(() => { });   // fehlende Dateien werden still übersprungen
  }
}
const LAST = {};
const FALLBACK = { drop_tap: 'hit2', drop_up: 'rare', drop_charge: 'whoosh', drop_shatter: 'boom', skin_kosmos_start: 'go', skin_kosmos_die: 'nova', portal: 'whoosh', wall: 'block', skin_kosmos_cast: 'nova', skin_kosmos_hit: 'coin', mythic: 'legend', helper: 'pop', grow: 'whoosh', mute: 'zap', mood: 'coin', bombdrop: 'tick', shield: 'block', boing: 'pop', cannon: 'boom', grate: 'block', catch: 'hit' };   // falls ein neuer Effekt noch nicht geladen ist
export function sfx(name, v) {
  if (!ctx || mode < 1) return;
  const buf = buffers[name] || buffers[FALLBACK[name]]; if (!buf) return;
  const now = ctx.currentTime;
  if (LAST[name] && now - LAST[name] < .035) return;   // nicht dutzendfach pro Moment
  LAST[name] = now;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = 1 + (VARY[name] ? (Math.random() - .5) * 2 * VARY[name] : 0);
  g.gain.value = (v == null ? 1 : v) * .9;
  src.connect(g); g.connect(fxBus); src.start(now);
}

/* ---------- Musik: KI-erzeugte Schleifen (ElevenLabs Music), je Szene eine, mit Überblendung ---------- */
const TRACKS = { menu: '/audio/music_menu.mp3', fight: '/audio/music_fight.mp3', drop: '/audio/music_drop.mp3' };
const musicBufs = {};
let cur = null, musicLoading = false;
function loadMusic() {
  if (musicLoading || !ctx) return;
  musicLoading = true;
  for (const k in TRACKS) {
    fetch(TRACKS[k]).then(r => { if (!r.ok) throw new Error('fehlt'); return r.arrayBuffer(); }).then(ab => ctx.decodeAudioData(ab)).then(buf => { musicBufs[k] = buf; playScene(); }).catch(() => { });
  }
}
function fadeOut(c) {
  if (!c) return;
  const t = ctx.currentTime;
  c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t); c.gain.gain.linearRampToValueAtTime(0, t + .9);
  try { c.src.stop(t + 1); } catch (e) { }
}
function playScene() {
  if (!ctx || mode < 2) return;
  const want = scene === 'fight' ? 'fight' : scene === 'drop' && musicBufs.drop ? 'drop' : 'menu';
  if (cur && cur.scene === want) return;
  const buf = musicBufs[want];
  if (!buf) return;   // kommt nach dem Laden nochmal hierher
  fadeOut(cur);
  const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
  src.buffer = buf; src.loop = true; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.2);
  src.connect(g); g.connect(musBus); src.start(t);
  cur = { src, gain: g, scene: want };
}
function startMusic() { loadMusic(); playScene(); }
function stopMusic() { fadeOut(cur); cur = null; }
export function setScene(s) { scene = s; playScene(); }
