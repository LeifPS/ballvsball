// Zeichnen der Bälle, Geschosse und Effekte (Tonlinge-Stil, vorgerenderte Sprites mit 3 Boil-Frames).
import { DEFS } from './engine.js';
import { INK, DPR, mkSprite, spr as spr0, sketchCtx } from './sk.js';
import { BALLS, VARIANTS, OB, PARTS, S0, R0, setNoHeld } from './ballart.js';
import { nearestEnemy } from './core.js';
import { SKIN_BY_ID } from './skins.js';

const SC = DPR > 1.5 ? 1.35 : 1;
const SIDE = 200;
const BODY = {}, OBJS_SP = {}, PART_SP = {};
const KS = { riese: .87, glas: 1.28, toast: .98, kreisel: .94, ufo: .8 };   // Sprite-Körper passt zum Radius

export function bodySprite(type, fight) {
  if (fight && HELD[type]) return BODYF[type] || (BODYF[type] = mkSprite('b_' + type, SIDE, S0, (c, s) => { setNoHeld(true); try { BALLS[type](c, s); } finally { setNoHeld(false); } }, SC));
  return BODY[type] || (BODY[type] = mkSprite('b_' + type, SIDE, S0, BALLS[type] || VARIANTS[type], SC));
}
// Gehaltene Waffen: drehen sich im Kampf zum nächsten Gegner und zucken beim Schuss zurück
const BODYF = {};
const HELD = { turret: { part: 'barrel', d: .15, flash: true }, pfeil: { part: 'bow', d: .35, nock: 'bownock' }, messer: { part: 'knife', d: .45 }, astronaut: { part: 'blaster', d: .5, flash: true } };
function objSprite(key) {
  let sp = OBJS_SP[key];
  if (!sp) {
    const d = OB[key] || OB.bullet, rad = d[0], side = Math.ceil(rad * 2 * d[2]);
    sp = OBJS_SP[key] = mkSprite('o_' + key, side, Math.max(14, rad * 2.2), (c, s) => d[1](c, s), side < 80 ? 2 : 1);
    sp.rad = rad;
  }
  return sp;
}
function partSprite(key) {
  let sp = PART_SP[key];
  if (!sp) {
    const d = PARTS[key], side = Math.ceil(d[0] * 2.4);
    sp = PART_SP[key] = mkSprite('p_' + key, side, 30, (c, s) => d[1](c, s), 1.6);
    sp.rad = d[0];
  }
  return sp;
}

/* ---------- Zustand je Ball (nur Darstellung) ---------- */
const VS = new Map();
function vstate(b) {
  let v = VS.get(b);
  if (!v) { v = { sq: 0, ax: 0, pvx: b.vx, pvy: b.vy }; VS.set(b, v); }
  return v;
}

export function ringJ(g, x, y, r, w, col, f, seed) {
  const n = Math.max(12, Math.round(r / 2.5)), a0 = ((seed * 37 + f * 13) % 10) * .1;
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath();
  for (let i = 0; i <= n + 1; i++) {
    const a = a0 + i / n * 6.2832, rr = r * (1 + Math.sin(i * 1.7 + f * 2.1 + seed) * .018 + Math.sin(i * .6 + seed) * .012);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}
// Handgezeichnet auch bei Partikeln: wackelige Doppellinie und versetzte Füllung (sketchCtx), das Wackeln springt im Takt der Zeichen-Frames
let TF = 0;
const hd = (g, k, size, amin) => sketchCtx(g, Math.sin(k * 12.9898) * 7 + (TF % 3) * 1.713, size || 14, amin == null ? .35 : amin);   // kleine Teile wackeln weniger, damit sie nicht zu Klecksen werden
// Partikel: Wackeln relativ zur Teilchengröße, damit die Handzeichnung auch bei kleinen Teilen sichtbar bleibt
const hdp = (g, k, sz) => sketchCtx(g, Math.sin(k * 12.9898) * 7 + (TF % 3) * 1.713, sz * 6, sz * .17);
export function star(g, x, y, r, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); const h = hdp(g, x * .37 + y * .71 + r, r); h.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; h[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); }
  h.closePath(); g.fillStyle = col; h.fill(); g.lineWidth = Math.max(1, r * .18); h.lineWidth = g.lineWidth; g.strokeStyle = INK; h.stroke(); g.restore();
}


const WHITE = new WeakMap();
function whiteOf(cv) {
  let w = WHITE.get(cv);
  if (!w) {
    w = document.createElement('canvas'); w.width = cv.width; w.height = cv.height;
    const c = w.getContext('2d'); c.drawImage(cv, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, w.width, w.height);
    WHITE.set(cv, w);
  }
  return w;
}

/* ---------- Ball ---------- */
// Koordinaten in Arena-Einheiten; tf = Boil-Frame, tm = Sekunden
let MC = null;
function moodOverlay(g, frame, side, tm, hot) {
  if (!MC) MC = document.createElement('canvas');
  if (MC.width !== frame.width || MC.height !== frame.height) { MC.width = frame.width; MC.height = frame.height; }
  const m = MC.getContext('2d'), W = MC.width, H = MC.height;
  m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, W, H); m.drawImage(whiteOf(frame), 0, 0);
  m.globalCompositeOperation = 'source-in';
  const per = W * .9, off = ((tm * (hot ? 1.5 : .45)) % 1) * per, gr = m.createLinearGradient(off - per, off - per, off + per, off + per);
  const c1 = hot ? 'rgba(255,50,30,.88)' : 'rgba(50,100,230,.85)', c2 = hot ? 'rgba(255,190,40,.78)' : 'rgba(100,150,255,.8)', c0 = hot ? 'rgba(255,90,30,.25)' : 'rgba(70,120,230,.3)';
  [[0, c0], [.2, c1], [.4, c2], [.6, c0], [.8, c1], [1, c0]].forEach(q => gr.addColorStop(q[0], q[1]));
  m.fillStyle = gr; m.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = hot ? .72 + .28 * Math.sin(tm * 12) : .8; g.drawImage(MC, -side / 2, -side / 2, side, side); g.restore();
}
function badge(g, x, y, txt, col, tf) {
  g.save(); g.font = '700 15px "Patrick Hand", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(txt).width + 12, sk = sketchCtx(g, 5.1 + (tf % 3) * 1.713, 22);
  g.lineJoin = g.lineCap = 'round'; g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.8; sk.lineWidth = 1.8;
  sk.beginPath(); sk.moveTo(x - w / 2, y - 9); sk.lineTo(x + w / 2, y - 9); sk.lineTo(x + w / 2, y + 9); sk.lineTo(x - w / 2, y + 9); sk.closePath(); sk.fill(); sk.stroke();
  g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.4; g.strokeText(txt, x, y + 1); g.fillText(txt, x, y + 1); g.restore();
}

/* ---------- Skins: Partikel (ab Selten), Angriffs- und Heileffekte (ab Episch), Animationen (ab Legendär), Start-, Todeseffekt (Mythisch) ---------- */
const RB = ['#ff5a5a', '#ffb02e', '#ffe83b', '#4fd45a', '#3bb7ff', '#a77ae8'];
const skinCol = (col, i) => col === 'rainbow' ? RB[((i % RB.length) + RB.length) % RB.length] : col;
function skinPart(g, kind, x, y, col, sz, rot) {
  if (kind === 'star') { star(g, x, y, sz, col, rot); return; }
  g.save(); g.translate(x, y); g.rotate(rot || 0); const h = hdp(g, x * .31 + y * .53 + sz, sz); g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = Math.max(1, sz * .22); h.lineWidth = g.lineWidth; g.lineJoin = 'round'; h.beginPath();
  if (kind === 'heart') { h.moveTo(0, sz * .9); h.bezierCurveTo(-sz * 1.5, -sz * .1, -sz * .9, -sz * 1.2, 0, -sz * .4); h.bezierCurveTo(sz * .9, -sz * 1.2, sz * 1.5, -sz * .1, 0, sz * .9); }
  else if (kind === 'shard') { h.moveTo(0, -sz * 1.3); h.lineTo(sz * .6, 0); h.lineTo(0, sz * 1.3); h.lineTo(-sz * .6, 0); }
  else if (kind === 'flower') { for (let i = 0; i < 5; i++) { const a = i * 1.2566; h.moveTo(0, 0); h.ellipse(Math.cos(a) * sz * .7, Math.sin(a) * sz * .7, sz * .55, sz * .38, a, 0, 7); } }
  else if (kind === 'ember') { h.moveTo(0, -sz * 1.2); h.quadraticCurveTo(sz * .9, -sz * .1, 0, sz * .8); h.quadraticCurveTo(-sz * .9, -sz * .1, 0, -sz * 1.2); }
  else h.arc(0, 0, kind === 'coin' ? sz * .8 : sz * .6, 0, 7);
  h.closePath(); h.fill(); h.stroke();
  if (kind === 'coin') { h.beginPath(); h.arc(0, 0, sz * .42, 0, 7); h.stroke(); }
  g.restore();
}

// Farbschema des Skins gilt auch für alle Angriffsobjekte (Stacheln, Bumerang, Feuer ...): Sprite wird umgefärbt (Helligkeit bleibt)
let CUR_TINT = null;
const TINTED = new Map();
function tintSp(sp, col) {
  const k = col; let m = TINTED.get(sp); if (!m) TINTED.set(sp, m = {});
  if (m[k]) return m[k];
  const fr = sp.fr.map(cv => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d');
    x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'color'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(cv, 0, 0); return c; });
  return m[k] = { fr, side: sp.side, sc: sp.sc, rad: sp.rad };
}
function spr(g, sp, ...a) { return spr0(g, CUR_TINT ? tintSp(sp, CUR_TINT) : sp, ...a); }
function skinTint(sk, tm) {
  const a = sk.atk;
  if (a) return skinCol(a.col, Math.floor(tm * 4));
  const p = sk.pal || {}; return p.spike || p.flame || p.band || p.body || null;
}
const ownerSkin = (sim, id) => { const b = sim && sim.byId ? sim.byId[id] : null; return b && b.skin ? SKIN_BY_ID[b.skin] : null; };
// Partikel am Ball: kreisen (orbit), steigen auf (rise) oder bleiben hinter dem Ball zurück (trail)
function skinAmbient(g, b, sk, tm) {
  const p = sk.part, n = p.n || 4, r = b.r;
  for (let i = 0; i < n; i++) {
    const col = skinCol(p.col, i);
    if (p.mode === 'rise') { const ph = (tm * .55 + i / n) % 1; g.globalAlpha = Math.sin(ph * Math.PI); skinPart(g, p.kind, Math.sin(tm * 1.7 + i * 2.3) * r * .95, r * .6 - ph * r * 2.4, col, 4.6 + (i % 2) * 1.4, Math.sin(tm * 3 + i) * .6); }
    else if (p.mode === 'trail') { const v = Math.hypot(b.vx, b.vy) || 1, ph = (tm * 2.2 + i / n) % 1; g.globalAlpha = 1 - ph; skinPart(g, p.kind, -b.vx / v * (r + ph * r * 2.4) + Math.sin(tm * 9 + i * 2) * 3, -b.vy / v * (r + ph * r * 2.4) + Math.cos(tm * 8 + i * 3) * 3, col, 4.4 * (1 - ph * .5), tm * 4 + i); }
    else { const a = tm * 1.7 + i * 6.2832 / n, rr = r * 1.45 + Math.sin(tm * 3 + i) * 2.5; skinPart(g, p.kind, Math.cos(a) * rr, Math.sin(a) * rr * .9, col, 4.8 + (i % 2) * 1.4, tm * 2 + i); }
  }
  g.globalAlpha = 1;
}
// Ein Burst aus Skin-Partikeln (Treffer, Heilung, Start, Tod)
function skinBurst(x, y, atk, n, speed, life, up) {
  for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, v = speed * (.35 + rnd() * .75); pt({ k: 'sp', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), age: 0, life: life * (.7 + rnd() * .5), shape: atk.kind, col: skinCol(atk.col, i), sz: 3 + rnd() * 2.6, rot: rnd() * 6 }); }
}
// Angriffe eines Skin-Balls: Geschoss sieht neu aus, Zonen und Wellen bekommen Skin-Partikel
function skinProj(g, o, sk, tm) {
  const a = sk.atk, sp = Math.hypot(o.vx, o.vy) || 1, ux = o.vx / sp, uy = o.vy / sp, sz = Math.max(5, o.r * 1.5);
  for (let i = 3; i >= 1; i--) { g.globalAlpha = .75 - i * .18; skinPart(g, a.kind, o.x - ux * i * 8 + Math.sin(tm * 9 + i * 2) * 2, o.y - uy * i * 8 + Math.cos(tm * 8 + i * 3) * 2, skinCol(a.col2 || a.col, i), sz * (1 - i * .16), tm * 4 + i); }
  g.globalAlpha = 1; skinPart(g, a.kind, o.x, o.y, skinCol(a.col, Math.floor(tm * 6)), sz, tm * 5);
}
function skinZone(g, o, sk, tm) {
  const a = sk.atk, rr = Math.max(14, o.r || 20);
  for (let i = 0; i < 5; i++) { const an = tm * 2 + i * 1.2566; skinPart(g, a.kind, o.x + Math.cos(an) * rr * .8, o.y + Math.sin(an) * rr * .8, skinCol(a.col, i), 3.2, tm * 3 + i); }
}
// Animationen (Legendär und höher): bewegliche Teile hinter oder vor dem Ball
const ANIM = {
  dragon: {
    back(g, b, tm, k) { const r = b.r, fl = Math.sin(tm * 8) * .5; g.lineJoin = g.lineCap = 'round'; g.lineWidth = 2.6; g.strokeStyle = INK;
      [-1, 1].forEach(d => { g.save(); g.translate(d * r * .75, -r * .2); g.rotate(d * (.35 + fl)); g.scale(d, 1); g.fillStyle = '#3a8a3a'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * .9, -r * 1.5, r * 1.9, -r * .4); g.quadraticCurveTo(r * 1.45, -r * .35, r * 1.4, r * .15); g.quadraticCurveTo(r * .95, 0, r * .8, r * .45); g.quadraticCurveTo(r * .5, r * .1, 0, r * .3); g.closePath(); g.fill(); g.stroke(); g.restore(); }); }
  },
  phoenix: {
    back(g, b, tm, k) { const r = b.r, fl = Math.sin(tm * 5) * .35; g.lineJoin = g.lineCap = 'round'; g.lineWidth = 2.4; g.strokeStyle = INK;
      [-1, 1].forEach(d => { g.save(); g.translate(d * r * .7, -r * .1); g.rotate(d * (.25 + fl)); g.scale(d, 1);
        [['#ff5a1a', 1], ['#ff9a2a', .8], ['#ffd45a', .55]].forEach(([col, sc]) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * .9 * sc, -r * 1.4 * sc, r * 1.9 * sc, -r * .5 * sc + Math.sin(tm * 9) * 2); g.quadraticCurveTo(r * 1.4 * sc, -r * .1, r * 1.3 * sc, r * .5 * sc); g.quadraticCurveTo(r * .8 * sc, r * .1, 0, r * .3 * sc); g.closePath(); g.fill(); if (sc === 1) g.stroke(); });
        g.restore(); }); },
    front(g, b, tm, k) { const r = b.r; g.lineJoin = g.lineCap = 'round'; g.lineWidth = 2.2; g.strokeStyle = INK;
      [[-.55, .9, 0], [0, 1.25, 1], [.55, .9, 2]].forEach(([dx, h, i]) => { const w = Math.sin(tm * 9 + i * 2) * r * .12, hh = r * h + Math.sin(tm * 11 + i) * r * .12; g.fillStyle = i === 1 ? '#ffd24a' : '#ff9a2a'; g.beginPath(); g.moveTo(dx * r - r * .28, -r * .75); g.quadraticCurveTo(dx * r - r * .3 + w, -r * .75 - hh * .6, dx * r + w, -r * .75 - hh); g.quadraticCurveTo(dx * r + r * .32, -r * .75 - hh * .5, dx * r + r * .28, -r * .75); g.closePath(); g.fill(); g.stroke(); }); }
  },
  pirate: {
    front(g, b, tm, k) { const r = b.r, sw = Math.sin(tm * 3.2) * .55; g.lineJoin = g.lineCap = 'round';
      g.save(); g.translate(-r * .98, r * .1); g.rotate(sw); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * .22); g.stroke(); g.fillStyle = '#ffd45a'; g.lineWidth = 2; g.beginPath(); g.arc(0, r * .38, r * .17, 0, 7); g.fill(); g.stroke(); g.restore();
      const fw = Math.sin(tm * 6) * r * .18; g.save(); g.translate(r * .35, -r * 1.42); g.strokeStyle = INK; g.lineWidth = 2; g.fillStyle = '#e0453a'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(r * .25 + fw, -r * .6, r * .7 + fw * 1.4, -r * .5); g.quadraticCurveTo(r * .35 + fw, -r * .25, 0, r * .05); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  },
  kosmos: {
    back(g, b, tm, k) { const r = b.r; g.save(); g.rotate(tm * .5); g.scale(1, .32); g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, r * 1.75, Math.PI, 0); g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#ffd45a'; g.beginPath(); g.arc(0, 0, r * 1.75, Math.PI, 0); g.stroke(); g.restore(); },
    front(g, b, tm, k) { const r = b.r; g.save(); g.rotate(tm * .5); g.scale(1, .32); g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.arc(0, 0, r * 1.75, 0, Math.PI); g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#ffd45a'; g.beginPath(); g.arc(0, 0, r * 1.75, 0, Math.PI); g.stroke(); g.restore();
      const a = tm * 2.4; g.fillStyle = '#6ad0ff'; g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * .8, r * .2, 0, 7); g.fill(); g.stroke(); const a2 = -tm * 1.7 + 2; g.fillStyle = '#ff7ad8'; g.beginPath(); g.arc(Math.cos(a2) * r * 1.3, Math.sin(a2) * r * 1.05, r * .14, 0, 7); g.fill(); g.stroke();
      for (let i = 0; i < 3; i++) { g.globalAlpha = .5 + .5 * Math.sin(tm * 4 + i * 2); star(g, Math.cos(i * 2.1 + tm * .8) * r * .9, -r * 1.15 + Math.sin(i * 2.1) * r * .25, 2.6, '#fff2a0', tm); } g.globalAlpha = 1; }
  }
};
// Mythisch: Starteffekt beim Countdown (3, 2, 1) - wird einmal von der Kampfansicht aufgerufen
export function skinStartFx(sim) {
  for (const b of sim.balls) { const sk = b.skin && SKIN_BY_ID[b.skin]; if (!sk || sk.start !== 'portal') continue;
    for (let i = 0; i < 3; i++) pt({ k: 'ring', x: b.x, y: b.y, age: 0, life: .55 + i * .22, r: b.r * (2.6 + i * .7), col: skinCol('rainbow', i * 2) });
    skinBurst(b.x, b.y, sk.atk, 18, 140, 1, 20); if (sk.snd && sk.snd.start) snd(sk.snd.start, .9); }
}
let sim0 = null;
export function drawBall(g, b, sim, tf, tm, tint) {
  TF = tf;
  const d = b.def, st = b.st || {}, v = vstate(b), f = tf + b.id, type = b.type;
  const k = b.r / R0 * (KS[type] || 1), x = b.x, y = b.y;
  if (b.vx * v.pvx < 0 || b.vy * v.pvy < 0) { v.sq = .16; v.ax = (b.vx * v.pvx < 0) ? 0 : 1; }
  v.pvx = b.vx; v.pvy = b.vy;
  if (v.sq > 0) v.sq -= 1 / 60;
  const q = Math.max(0, v.sq) / .16, sx = v.ax === 0 ? 1 - .22 * q : 1 + .12 * q, sy = v.ax === 0 ? 1 + .12 * q : 1 - .22 * q;
  const bob = 1 + .025 * Math.sin(tm * 7 + b.id * 2);
  const tilt = Math.max(-1, Math.min(1, b.vx / (b.speed || 100))) * .1;
  g.save(); g.translate(x, y);
  const ghost = st.ghost > 0;
  if (ghost) g.globalAlpha = .45;
  /* hinten */
  if (type === 'saege') { const p = partSprite('sawdisc'); spr(g, p, 0, 0, f, (b.r + 8) / p.rad * 1.1, tm * 3); }
  else if (type === 'echo' && st.ghosts) { for (let i = 0; i < st.ghosts.length; i++) { const gh = st.ghosts[i]; spr(g, bodySprite('echo'), gh[0] - x, gh[1] - y, f + i, k * (SIDE / SIDE), 0, .3 - i * .05); } }
  else if (type === 'spinne' && st.th) {   // Fäden: handgezeichnet (wackelige Doppellinie, leichter Durchhang, Knoten an der Wand)
    g.lineCap = g.lineJoin = 'round';
    for (let i = 0; i < st.th.length; i++) {
      const ax = st.th[i].x - x, ay = st.th[i].y - y, mx = ax / 2, my = ay / 2, L = Math.hypot(ax, ay) || 1, sag = Math.min(8, L * .06) * Math.sin(tm * 2 + i), cx = mx - ay / L * sag, cy = my + ax / L * sag;
      const sk = sketchCtx(g, i * 1.37 + (tf % 3) * 1.713, 26); g.lineWidth = 2.5; sk.lineWidth = 2.5; g.strokeStyle = 'rgba(48,42,38,.9)';
      sk.beginPath(); sk.moveTo(ax, ay); sk.quadraticCurveTo(cx, cy, 0, 0); sk.stroke();
      g.fillStyle = '#f3efe4'; g.lineWidth = 1.4; sk.beginPath(); sk.arc(ax, ay, 3.4, 0, 7); sk.fill(); sk.stroke();
    }
  }
  else if (type === 'magnet' && !b.preview) { const ph = (tm * 70) % 190; ringJ(g, 0, 0, ph, 1.1, 'rgba(211,58,58,' + (.35 * (1 - ph / 190)).toFixed(2) + ')', tf, b.id); }
  else if (type === 'supernova' && st.ch > 0) { const rr = b.r * (1.5 + st.ch * 2), gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, 'rgba(255,240,150,' + (.15 + st.ch * .5) + ')'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); }
  else if (type === 'schwarzloch') { ringJ(g, 0, 0, 38 + Math.sin(tm * 3) * 4, 1.2, 'rgba(139,79,201,.4)', tf, b.id); }
  else if (type === 'tornado') { const p = partSprite('swirl'); spr(g, p, 0, 0, f, (b.r + 14) / p.rad, tm * 4, .55); }
  { const sk = b.skin && SKIN_BY_ID[b.skin], an = sk && sk.anim && ANIM[sk.anim]; if (an && an.back) { g.save(); an.back(hd(g, b.id * 5.3, 40), b, tm, k); g.restore(); } }   // Skin-Animationen hinter dem Ball
  /* Körper */
  g.save(); g.rotate(type === 'blauast' && !b.preview ? tm * 4 : tilt); g.scale(sx * bob * k, sy * bob * k);
  if (type === 'herrscher') {   // Regenbogen-Körper, dreht sich langsam
    const gr = g.createConicGradient ? g.createConicGradient(tm * 1.6, 0, 0) : g.createLinearGradient(-R0, -R0, R0, R0);
    ['#ff3b3b', '#ffb02e', '#ffe83b', '#4fd45a', '#3bb7ff', '#8a5cff', '#ff3bd0', '#ff3b3b'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    { const h = hd(g, 5.5, 40); g.fillStyle = gr; h.beginPath(); h.arc(0, 0, R0, 0, 7); h.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; h.beginPath(); h.ellipse(-R0 * .42, -R0 * .5, R0 * .16, R0 * .09, -.7, 0, 7); h.fill(); }
  }
  const sp = bodySprite(b.skin ? b.skin : type === 'erik' && st.emo != null ? 'erik_' + 'wfta'[st.emo] : type === 'gefuehl' && st.mode != null ? 'gefuehl_' + 'fwa'[st.mode] : type, !b.preview);
  g.drawImage(sp.fr[((f % 3) + 3) % 3], -sp.side / 2, -sp.side / 2, sp.side, sp.side);
  // Fröhlich/Wütend/Gefühlsball: liegt der Ball hinten, läuft ein Farbverlauf über den Ball (blau und gedämpft = halber Schaden, rot und lodernd = doppelter Schaden)
  if (!b.preview && st.weak && (type === 'froh' || type === 'wuet' || (type === 'gefuehl' && st.mode < 2))) moodOverlay(g, sp.fr[((f % 3) + 3) % 3], sp.side, tm, type === 'wuet' || (type === 'gefuehl' && st.mode === 1));
  // Weißes Aufblinken: nur die Silhouette des Balls (kein Kreis), bei Treffern kurz, bei Dauerschaden langsam pulsierend
  const pulse = b.dotT > 0 ? .55 * Math.pow(Math.max(0, Math.sin(tm * 13 + b.id)), 2) : 0;
  const fl = Math.max(b.flash > 0 ? b.flash * 6 : 0, pulse) + (tint || 0);
  if (fl > 0) {
    g.globalAlpha = Math.min(.8, fl);
    g.drawImage(whiteOf(sp.fr[((f % 3) + 3) % 3]), -sp.side / 2, -sp.side / 2, sp.side, sp.side);
  }
  g.restore();
  g.globalAlpha = ghost ? .45 : 1;
  { const sk = b.skin && SKIN_BY_ID[b.skin]; if (sk) { if (sk.part) skinAmbient(g, b, sk, tm); const an = sk.anim && ANIM[sk.anim]; if (an && an.front) { g.save(); an.front(hd(g, b.id * 3.7, 40), b, tm, k); g.restore(); } } }
  /* vorne */
  if (type === 'schwert') {
    const n = st.n || 1, ang = st.ang || 0, p = partSprite('dagger');
    for (let i = 0; i < n; i++) { const a = ang + i * 6.2832 / n; spr(g, p, Math.cos(a) * (b.r + 4), Math.sin(a) * (b.r + 4), f + i, 1, a); }
  } else if (type === 'schmied') {
    const lv = Math.min(8, st.lv || 0);
    for (let i = 0; i < lv; i++) star(g, (i - (lv - 1) / 2) * 8, -b.r - 10, 3.4, '#ffd45a');
  } else if (type === 'schild') {
    const a = st.ang || 0, p = partSprite('shieldarc'); spr(g, p, 0, 0, f, (b.r + 8) / 26, a);
  } else if (type === 'schwarm') {
    const p = objSprite('bee');
    for (let i = 0; i < 3; i++) { const a = tm * 2.2 + i * 2.094; spr(g, p, Math.cos(a) * (b.r + 11), Math.sin(a) * (b.r + 11) * .8, f + i, .8, 0); }
  } else if (type === 'mond' && st.sat) {
    spr(g, partSprite('moon'), st.sat[0] - x, st.sat[1] - y, f, 1.1, 0);
  } else if (type === 'saturn') {
    g.strokeStyle = 'rgba(29,39,66,.25)'; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.arc(0, 0, b.r + 24, 0, 7); g.stroke(); g.setLineDash([]);
  } else if (type === 'mixer') {
    const a = tm * 9; for (let i = 0; i < 3; i++) { const aa = a + i * 2.094; spr(g, partSprite('blade'), Math.cos(aa) * (b.r * .3), Math.sin(aa) * (b.r * .3), f + i, (b.r + 10) / 24, aa, .75); }
  } else if (type === 'kreisel' && st.spin > 0) {
    ringJ(g, 0, 0, b.r + 12, 2.4, 'rgba(255,255,255,.8)', tf, b.id); ringJ(g, 0, 0, b.r + 12, 1.2, INK, tf + 1, b.id + 5);
    { const h = hd(g, b.id * 1.9, 30); for (let i = 0; i < 4; i++) { const a = tm * 12 + i * 1.57; g.strokeStyle = INK; g.lineWidth = 1.4; h.lineWidth = 1.4; h.beginPath(); h.arc(0, 0, b.r + 12, a, a + .5); h.stroke(); } }
  } else if (type === 'pfanne') {
    const a = st.ang || 0; spr(g, partSprite('pan'), Math.cos(a) * (b.r + 10), Math.sin(a) * (b.r + 10), f, .85, a);
  } else if (type === 'drache' && st.breath > 0) {
    const ax = st.ax, ay = st.ay, p = objSprite('fireZone');
    for (let i = 0; i < 9; i++) { const dist = b.r + 8 + i * 15, w = .45 + i * .1; spr(g, p, ax * dist, ay * dist, f + i, w * (.9 + .15 * Math.sin(tm * 14 + i)), 0, .88); }
  }
  /* Gefühle: Zustandsanzeigen */
  if (type === 'stolz' && st.proud && !b.preview) star(g, 0, -b.r - 20, 4.4 + Math.sin(tm * 6) * .6, '#ffd21f');
  if ((type === 'herrscher' || type === 'kleinexplus') && st.shield) { g.save(); g.fillStyle = 'rgba(170,220,255,.28)'; g.beginPath(); g.arc(0, 0, b.r + 6, 0, 7); g.fill(); g.restore(); ringJ(g, 0, 0, b.r + 6, 2.4, 'rgba(255,255,255,.95)', tf, b.id + 4); ringJ(g, 0, 0, b.r + 6, 1.2, INK, tf + 1, b.id + 6); }
  if (type === 'kleinexplus') { g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; const sk = sketchCtx(g, 2.7 + (tf % 3) * 1.713, 18); sk.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = tm * 6 + i * 1.571; sk.beginPath(); sk.arc(0, 0, b.r + 7, a, a + .7); sk.stroke(); } }
  if (type === 'gefuehl') { g.save(); g.globalAlpha = (ghost ? .45 : 1) * .55; const sk = sketchCtx(g, 4.4 + (tf % 3) * 1.713, 26); g.strokeStyle = INK; g.lineWidth = 1.4; sk.lineWidth = 1.4; for (let i = 0; i < 4; i++) { const a = tm * .9 + i * 1.571; g.fillStyle = '#a79fb6'; sk.beginPath(); sk.ellipse(Math.cos(a) * b.r * 1.05, Math.sin(a) * b.r * .95, b.r * .36, b.r * .26, a, 0, 7); sk.fill(); sk.stroke(); } g.restore(); }
  if (b.silenced && !b.preview) { g.save(); g.globalAlpha *= .95; const sk = sketchCtx(g, 6.6 + (tf % 3) * 1.713, 20); g.lineJoin = g.lineCap = 'round'; g.fillStyle = '#e8e4d6'; g.strokeStyle = INK; g.lineWidth = 1.8; sk.lineWidth = 1.8; sk.beginPath(); sk.arc(0, -b.r - 24, 8, 0, 7); sk.fill(); sk.stroke(); sk.beginPath(); sk.moveTo(-5, -b.r - 19); sk.lineTo(5, -b.r - 29); sk.stroke(); g.restore(); }
  if (type === 'allesherr' && !b.preview) { const a = tm * 2.6; g.save(); g.translate(Math.cos(a) * (b.r + 9), Math.sin(a) * (b.r + 9)); g.rotate(a + 1.57); spr(g, partSprite('magnet'), 0, 0, f, 1, 0); g.restore(); }
  if (type === 'rallaxa' && !b.preview) {
    const ch = st.charge || 0;
    if (ch < 1) { g.save(); g.strokeStyle = 'rgba(80,80,100,.8)'; g.lineWidth = 2.6; g.lineCap = 'round'; const sk = sketchCtx(g, 8.2 + (tf % 3) * 1.713, 18); sk.lineWidth = 2.6; sk.beginPath(); sk.arc(0, 0, b.r + 6, -1.57, -1.57 + ch * 6.283); sk.stroke(); g.restore(); }
    else ringJ(g, 0, 0, b.r + 7, 2.2, 'rgba(60,60,90,.55)', tf, b.id + 8);
  }
  if (b.hold > 0 && !b.preview) { for (let i = 0; i < 3; i++) ringJ(g, 0, 0, b.r + 5 + i * 5 + Math.sin(tm * 10 + i) * 1.5, 2.2, 'rgba(40,40,60,' + (.7 - i * .18).toFixed(2) + ')', tf, b.id + 11 + i); }
  if (type === 'blauast' && st.shield && !b.preview) { g.save(); g.fillStyle = 'rgba(170,220,255,.28)'; g.beginPath(); g.arc(0, 0, b.r + 6, 0, 7); g.fill(); g.restore(); ringJ(g, 0, 0, b.r + 6, 2.4, 'rgba(255,255,255,.95)', tf, b.id + 4); ringJ(g, 0, 0, b.r + 6, 1.2, INK, tf + 1, b.id + 6); }
  const H = HELD[type];
  if (H && !b.preview) {
    const e = nearestEnemy(sim, b), ta = e ? Math.atan2(e.y - b.y, e.x - b.x) : (v.aim == null ? 0 : v.aim);
    if (v.aim == null) v.aim = ta;
    let da = ta - v.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); v.aim += da * .3;
    const since = sim.t - (b.fireT == null ? -9 : b.fireT), kick = Math.max(0, 1 - since / .16), sc = b.r / 20;
    g.save(); g.rotate(v.aim); if (Math.cos(v.aim) < 0) g.scale(1, -1);
    g.translate(-kick * 4 * sc, 0);
    spr(g, partSprite(H.part), 0, 0, f, sc, 0);
    if (H.nock && since > .4) spr(g, partSprite(H.nock), -2 * sc, 0, f, sc, 0);
    if (H.flash && kick > .55) { star(g, 36 * sc, 0, 6 * sc * kick, '#ffe14a'); }
    g.restore();
  }
  if (b.burn > 0) {
    const p = objSprite('fireZone');
    for (let i = 0; i < 3; i++) spr(g, p, (i - 1) * b.r * .5, -b.r * .7 - Math.abs(Math.sin(tm * 8 + i)) * 4, f + i, .5, 0, .85);
  }
  if (b.stun > 0) {
    for (let i = 0; i < 3; i++) { const a = tm * 4 + i * 2.094; star(g, Math.cos(a) * b.r * .9, -b.r * 1.15 + Math.sin(a) * 4, 3.4, '#ffe14a'); }
    ringJ(g, 0, 0, b.r + 3, 1.6, 'rgba(120,200,255,.8)', tf, b.id + 9);
  }
  g.restore();
}

/* Vorschau-Ball: mittig im Canvas (Sammlung, Karten) */
const BIG = { riese: .8, drache: .82, phoenix: .8, vampir: .8, schwert: .85, spinne: .85, fledermaus: .7, sensenmann: .75, regenbogen: .72, pfanne: .8, schwarzloch: .8, mixer: .85, herd: .85, magier: .85, rakete: .8, saturn: .78, ufo: .85, kreisel: .85, wolke: .85, pokal: .85, erde: .9, supernova: .85 };
export function drawBallIn(ctx, type, size, tm, tf, fit, dark) {
  if (!BALLS[type]) return;
  const sp = bodySprite(type);
  const w = size * (fit || .62) * (BIG[type] || 1) * 2.15;
  ctx.save(); ctx.translate(size / 2, size / 2 + Math.sin(tm * 3 + type.length) * size * .012);
  if (dark) { ctx.filter = 'brightness(0)'; ctx.globalAlpha = .22; }
  if (type === 'herrscher') {
    const rr = R0 * w / SIDE, gr = ctx.createConicGradient ? ctx.createConicGradient(tm * 1.6, 0, 0) : ctx.createLinearGradient(-rr, -rr, rr, rr);
    ['#ff3b3b', '#ffb02e', '#ffe83b', '#4fd45a', '#3bb7ff', '#8a5cff', '#ff3bd0', '#ff3b3b'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill();
  }
  ctx.drawImage(sp.fr[((tf % 3) + 3) % 3], -w / 2, -w / 2, w, w);
  ctx.restore();
}

/* ---------- Geschosse, Fallen, Zonen ---------- */
const WAVE_COL = { shock: ['#9ad8ff', '#ffffff'], nova: ['#ffe14a', '#fff6c0'], quake: ['#a58862', '#d8c29a'], flame: ['#ff8a2a', '#ffd24a'], phase: ['#b46af0', '#f0d8ff'], ult: ['#ffc21a', '#fff6c0'] };
const ZONE = { rain: 'rainZone', lava: 'lavaZone', dust: 'dustZone', egg: 'eggZone', platte: 'platteZone', brew: 'brewZone' };
export const GROUND = { puddle: 1, fire: 1, spike: 1, bomb: 1, meteor: 1, mine: 1, wave: 1 };
export function drawObj(g, o, sim, tf, tm) {
  const osk = o.owner ? ownerSkin(sim, o.owner) : null;
  CUR_TINT = osk && !(o.k === 'mauer') ? skinTint(osk, tm) : null;
  try { drawObj0(g, o, sim, tf, tm, osk); } finally { CUR_TINT = null; }
  // Episch+: bewegliche Angriffsobjekte (Stacheln, Bumerang ...) ziehen Skin-Partikel hinter sich her
  if (osk && osk.atk && !o.proj && o.vx !== undefined && (o.vx || o.vy)) {
    const a = osk.atk, sp = Math.hypot(o.vx, o.vy) || 1, ux = o.vx / sp, uy = o.vy / sp;
    for (let i = 1; i <= 2; i++) { g.globalAlpha = .7 - i * .2; skinPart(g, a.kind, o.x - ux * i * 9 + Math.sin(tm * 9 + i * 2) * 2, o.y - uy * i * 9 + Math.cos(tm * 8 + i * 3) * 2, skinCol(a.col2 || a.col, i), 3.2, tm * 4 + i); }
    g.globalAlpha = 1;
  }
}
function drawObj0(g, o, sim, tf, tm, osk) {
  TF = tf;
  const f = tf + (o.owner || 0) * 3;
  if (osk && osk.atk && o.proj && o.vx !== undefined) { skinProj(g, o, osk, tm); return; }   // Geschosse im Skin-Look
  switch (o.k) {
    case 'mauer': {   // Ziegelmauer, handgezeichnet
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 5, ny = dx / L * 5, grow = Math.min(1, (8 - o.life) * 5 + .2), fade = Math.min(1, o.life * 1.5);
      const sk = sketchCtx(g, 2.3 + (tf % 3) * 1.713, 22); g.save(); g.globalAlpha = fade; g.lineJoin = g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 2.4; sk.lineWidth = 2.4;
      const mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2, ax = mx - dx / 2 * grow, ay = my - dy / 2 * grow, bx = mx + dx / 2 * grow, by = my + dy / 2 * grow;
      g.fillStyle = '#d98a5a'; sk.beginPath(); sk.moveTo(ax + nx, ay + ny); sk.lineTo(bx + nx, by + ny); sk.lineTo(bx - nx, by - ny); sk.lineTo(ax - nx, ay - ny); sk.closePath(); sk.fill(); sk.stroke();
      g.lineWidth = 1.4; sk.lineWidth = 1.4; sk.beginPath(); sk.moveTo(ax, ay); sk.lineTo(bx, by); for (let i = 1; i < 5; i++) { const t = i / 5, px = ax + (bx - ax) * t, py = ay + (by - ay) * t; sk.moveTo(px + nx, py + ny); sk.lineTo(px - nx, py - ny); } sk.stroke();
      g.restore(); break;
    }
    case 'spike': { const a = Math.atan2(o.ny, o.nx) + 1.5708; spr(g, objSprite('spike'), o.x, o.y, f, 1, a); break; }
    case 'bullet': case 'frost': case 'bee': {
      const key = o.vis || (o.k === 'bullet' ? 'bullet' : o.k), sp = objSprite(key), a = Math.atan2(o.vy, o.vx);
      spr(g, sp, o.x, o.y, f, Math.max(.8, o.r / sp.rad * (o.k === 'bee' ? 1.1 : 1)), a); break;
    }
    case 'fire': {
      const key = o.vis ? ZONE[o.vis] || 'fireZone' : 'fireZone', sp = objSprite(key), zone = key !== 'fireZone';
      if (zone) spr(g, sp, o.x, o.y, f, o.r / 30, 0, Math.min(.9, o.life / 1.2));
      else spr(g, sp, o.x, o.y + 3, f + Math.floor(o.x), o.r / 9 * .8, Math.sin(tm * 6 + o.x) * .1, Math.min(1, o.life / .6));
      break;
    }
    case 'puddle': {
      const key = o.vis ? ZONE[o.vis] || 'puddleZone' : 'puddleZone';
      spr(g, objSprite(key), o.x, o.y, f, o.r / 30, 0, Math.min(.9, o.life / 1.5));
      if (o.vis === 'rain') { const h = hd(g, o.x * .1, 20); for (let i = 0; i < 4; i++) { const ph = (tm * 2 + i * .3 + o.x) % 1; g.strokeStyle = 'rgba(80,150,220,.8)'; g.lineWidth = 1.4; h.lineWidth = 1.4; h.beginPath(); h.moveTo(o.x - o.r * .5 + i * o.r * .35, o.y - 26 + ph * 26); h.lineTo(o.x - o.r * .5 + i * o.r * .35 - 1.5, o.y - 18 + ph * 26); h.stroke(); } }
      break;
    }
    case 'boom': { const sp = objSprite(o.vis || 'boom'); spr(g, sp, o.x, o.y, f, Math.max(1, o.r / sp.rad), o.rot); break; }
    case 'saw': { const sp = objSprite(o.vis || 'saw'); spr(g, sp, o.x, o.y, f, Math.max(.9, o.r / sp.rad), o.rot); break; }
    case 'bomb': {
      const p = 1 - Math.max(0, o.fuse) / 1.8, pulse = .5 + .5 * Math.sin(tm * (10 + p * 20));
      ringJ(g, o.x, o.y, o.r, 1.4, 'rgba(211,58,58,' + (.25 + .4 * Math.max(0, p)).toFixed(2) + ')', tf, f);
      g.save(); g.globalAlpha = .06 + .12 * pulse * Math.max(0, p); g.fillStyle = '#d33a3a'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.2832); g.fill(); g.restore();
      spr(g, objSprite('bomb'), o.x, o.y + 2, f, .95 + .12 * pulse, 0); break;
    }
    case 'meteor': {
      const tot = o.vis === 'blitz' ? .55 : o.vis === 'potion' ? .8 : 1, p = 1 - Math.max(0, o.fuse) / tot, col = o.vis === 'blitz' ? '255,225,60' : o.vis === 'potion' ? '110,200,60' : '211,90,30';
      ringJ(g, o.x, o.y, o.r, 1.4, 'rgba(' + col + ',.6)', tf, f);
      ringJ(g, o.x, o.y, o.r * (1 - p) + 4, 1.3, 'rgba(' + col + ',.9)', tf, f + 1);
      g.save(); g.globalAlpha = .06 + .12 * p; g.fillStyle = 'rgb(' + col + ')'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.2832); g.fill(); g.restore();
      const kk = Math.max(0, o.fuse);
      if (o.vis === 'blitz') { if (kk < .22) spr(g, objSprite('blitz'), o.x, o.y, f, 1.6, 0, 1); }
      else if (kk > 0) { spr(g, objSprite(o.vis === 'potion' ? 'potion' : 'meteor'), o.x + kk * 90, o.y - kk * 330, f, 1.2, tm * 3); }
      break;
    }
    case 'wave': {
      const c2 = WAVE_COL[o.vis] || WAVE_COL.shock, a = Math.max(0, 1 - o.rad / o.maxR);
      g.save(); g.globalAlpha = Math.min(1, .35 + a);
      ringJ(g, o.x, o.y, o.rad, 7 * a + 2, INK, tf, f);
      ringJ(g, o.x, o.y, o.rad, 4.5 * a + 1, c2[0], tf, f + 1);
      ringJ(g, o.x, o.y, Math.max(1, o.rad - 3), 1.6, c2[1], tf, f + 2); g.restore(); break;
    }
    case 'mine': {
      const armed = (o.age || 0) >= o.arm, blink = armed && ((tm * 4 + o.x) % 1) < .3;
      spr(g, objSprite(o.vis || 'ufomine'), o.x, o.y, f, o.r / 8 * 1.2, 0, armed ? 1 : .55);
      if (blink) { g.fillStyle = 'rgba(255,60,60,.9)'; g.beginPath(); g.arc(o.x, o.y - 3, 1.8, 0, 7); g.fill(); }
      break;
    }
  }
  if (osk && osk.atk && !o.proj && (o.k === 'puddle' || o.k === 'fire' || o.k === 'wave' || o.k === 'boom' || o.k === 'meteor' || o.k === 'frost')) skinZone(g, o, osk, tm);   // Zonen und Wellen im Skin-Look
}

/* ---------- Effekte (Funken, Ringe, Zahlen) ---------- */
export const fxState = { shake: 0, hitstop: 0, ko: 0, koX: 0, koY: 0, sound: [], zoom: null };
const FXL = [];
function pt(e) { if (FXL.length < 260) FXL.push(e); }
export function clearFx() { FXL.length = 0; VS.clear(); fxState.shake = 0; fxState.hitstop = 0; fxState.ko = 0; fxState.zoom = null; fxState.sound.length = 0; }
let rs = 1234567;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
function sparks(x, y, n, col, speed, life, sz) { for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, v = speed * (.4 + rnd() * .8); pt({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, age: 0, life: life * (.7 + rnd() * .6), col, sz: sz * (.7 + rnd() * .6), rot: rnd() * 6 }); } }
function puffs(x, y, n, col, spread, sz) { for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, v = spread * (.3 + rnd() * .7); pt({ k: 'puff', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, age: 0, life: .5 + rnd() * .35, col, sz: sz * (.6 + rnd() * .7) }); } }
function snd(n, v) { if (fxState.sound.length < 12) fxState.sound.push([n, v == null ? 1 : v]); }
export function addFx(e) {
  const k = e.k, x = e.x, y = e.y;
  if (k === 'hit') {
    const a = e.a, big = Math.min(1, a / 30);
    sparks(x, y, 3 + Math.round(big * 5), '#ffd45a', 70 + big * 70, .3, 2.6 + big * 2);
    if (a >= 1) pt({ k: 'num', x: x + (rnd() - .5) * 10, y: y - 10, age: 0, life: .75, txt: String(Math.round(a)), sz: 9 + big * 9, col: big > .5 ? '#ffb02e' : '#ffffff' });
    fxState.shake = Math.min(7, Math.max(fxState.shake, .6 + a * .1));
    if (a >= 20) fxState.hitstop = Math.max(fxState.hitstop, .05 + Math.min(.04, (a - 20) * .002));
    snd(a >= 18 ? 'hit2' : 'hit', Math.min(1, .4 + big));
  } else if (k === 'tick') {
    sparks(x, y, 2, '#ff6a5a', 40, .3, 2.2);
    if (e.a >= .5) pt({ k: 'num', x: x + (rnd() - .5) * 14, y: y - 12, age: 0, life: .6, txt: String(Math.max(1, Math.round(e.a))), sz: 8, col: '#ff6a5a' });
    snd('tick', .5);
  } else if (k === 'boom' || k === 'zap' || k === 'brickboom' || k === 'kuerbisboom' || k === 'splash') {
    const col = k === 'zap' ? '#ffe14a' : k === 'brickboom' ? '#e0453a' : k === 'kuerbisboom' ? '#f58a1f' : k === 'splash' ? '#8fdc6e' : '#ff8a2a';
    pt({ k: 'ring', x, y, age: 0, life: .5, r: e.a, col });
    pt({ k: 'ring', x, y, age: 0, life: .35, r: e.a * .6, col: '#ffffff' });
    sparks(x, y, 10, col, 130, .5, 3.4); puffs(x, y, 5, 'rgba(120,110,100,.75)', 60, 7);
    fxState.shake = Math.max(fxState.shake, k === 'zap' ? 3 : 4.5);
    snd(k === 'zap' ? 'zap' : 'boom');
  } else if (k === 'die') {
    pt({ k: 'ring', x, y, age: 0, life: .8, r: e.a * 3.4, col: '#ffffff' }); pt({ k: 'ring', x, y, age: 0, life: .6, r: e.a * 2.2, col: INK });
    sparks(x, y, 22, '#ffd45a', 200, .9, 4.2); puffs(x, y, 10, 'rgba(255,255,255,.9)', 110, 9);
    for (let i = 0; i < 3; i++) pt({ k: 'star', x, y, age: 0, life: .9, vx: (rnd() - .5) * 120, vy: -80 - rnd() * 60, sz: 5 + rnd() * 3 });
    fxState.shake = 8; fxState.hitstop = Math.max(fxState.hitstop, .1); fxState.ko = .9; fxState.koX = x; fxState.koY = y;
    { const sk = SKIN_BY_ID[e.e]; if (sk && sk.die === 'supernova') {
      for (let i = 0; i < 4; i++) pt({ k: 'ring', x, y, age: 0, life: .7 + i * .15, r: e.a * (3.4 + i * 1.3), col: skinCol('rainbow', i * 2) });
      skinBurst(x, y, sk.atk, 34, 230, 1.1, 30); fxState.shake = 11; if (sk.snd && sk.snd.die) snd(sk.snd.die, 1); } }
    snd('die');
  } else if (k === 'heal') {
    for (let i = 0; i < 2; i++) pt({ k: 'plus', x: x + (rnd() - .5) * 16, y, age: 0, life: .8, vy: -22 });
    if (e.a >= 3) pt({ k: 'num', x, y: y - 14, age: 0, life: .8, txt: '+' + Math.round(e.a), sz: 10, col: '#6fdc7a' });
    { const sk = e.e && SKIN_BY_ID[e.e]; if (sk && sk.atk) skinBurst(x, y, sk.atk, 6, 40, .9, 40); }
    snd('heal', .5);
  } else if (k === 'block') { pt({ k: 'ring', x, y, age: 0, life: .25, r: 12, col: '#ffffff' }); sparks(x, y, 4, '#cfe4ff', 80, .25, 2.4); snd('block'); }
  else if (k === 'stun') { sparks(x, y, 5, '#ffe14a', 60, .5, 3); snd('stun'); }
  else if (k === 'dash') { for (let i = 0; i < 6; i++) pt({ k: 'puff', x, y, vx: (rnd() - .5) * 60, vy: (rnd() - .5) * 60, age: 0, life: .4, col: 'rgba(255,255,255,.8)', sz: 5 }); snd('dash'); }
  else if (k === 'nova') { pt({ k: 'ring', x, y, age: 0, life: .7, r: e.a, col: '#fff2a0' }); sparks(x, y, 20, '#ffe14a', 220, .7, 4); fxState.shake = 9; fxState.hitstop = Math.max(fxState.hitstop, .08); snd('nova'); }
  else if (k === 'rise') { pt({ k: 'ring', x, y, age: 0, life: .7, r: 40, col: '#bfffd0' }); sparks(x, y, 12, '#bfffd0', 90, .7, 3); snd('heal'); }
  else if (k === 'split') { pt({ k: 'ring', x, y, age: 0, life: .4, r: e.a * 2, col: '#b894e3' }); sparks(x, y, 8, '#c9aeee', 90, .4, 3); snd('pop'); }
  else if (k === 'levelup') { pt({ k: 'star', x, y, age: 0, life: .9, vx: 0, vy: -40, sz: 7 }); snd('coin', .6); }
  else if (k === 'grab') { sparks(x, y, 5, '#c9aeee', 70, .35, 3); snd('hit', .6); }
  else if (k === 'breath') { snd('whoosh'); }
  else if (k === 'helper') { pt({ k: 'ring', x, y, age: 0, life: .45, r: 22, col: '#7ad66a' }); sparks(x, y, 9, '#c9a6ff', 90, .6, 3); sparks(x, y, 5, '#7ad66a', 70, .5, 2.6); snd('helper'); }
  else if (k === 'grow') { pt({ k: 'ring', x, y, age: 0, life: .9, r: e.a * 2.2, col: '#ffe45a' }); pt({ k: 'ring', x, y, age: 0, life: .7, r: e.a * 1.5, col: '#ff7ab8' }); snd('grow'); }
  else if (k === 'mood') { const cols = ['#a8e68c', '#e8453c', '#6aa8ff']; pt({ k: 'ring', x, y, age: 0, life: .55, r: 34, col: cols[e.a | 0] }); sparks(x, y, 8, cols[e.a | 0], 100, .6, 3); snd('mood'); }
  else if (k === 'mute') { pt({ k: 'ring', x, y, age: 0, life: .4, r: e.a * 2.2, col: '#b8b4a8' }); sparks(x, y, 6, '#d8d4c8', 70, .45, 2.8); snd('mute'); }
  else if (k === 'bombdrop') { snd('bombdrop', .8); }
  else if (k === 'wall') { sparks(x, y, 6, '#d98a5a', 70, .4, 3); puffs(x, y, 3, 'rgba(160,120,90,.8)', 40, 6); snd('block', .8); }
  else if (k === 'skincast' || k === 'skinhit') {
    const sk = SKIN_BY_ID[e.e];
    if (sk && sk.atk) { if (k === 'skinhit') { pt({ k: 'ring', x, y, age: 0, life: .3, r: e.a === 0 ? 20 : 14, col: skinCol(sk.atk.col, 0) }); skinBurst(x, y, sk.atk, e.a === 0 ? 9 : 6, 110, .6, 10); } else skinBurst(x, y, sk.atk, 3, 60, .4, 0); }
    if (sk && sk.snd) snd(k === 'skincast' ? sk.snd.cast : sk.snd.hit, .8);
  }
  else if (k === 'shield') { pt({ k: 'ring', x, y, age: 0, life: .5, r: e.a * 3, col: '#bfe4ff' }); sparks(x, y, 10, '#ffffff', 110, .5, 2.8); snd('shield'); }
}
export function burst(x, y, n, cols) {   // Konfetti für Sieg
  for (let i = 0; i < n; i++) pt({ k: 'conf', x: x + (rnd() - .5) * 40, y, age: 0, life: 1.6 + rnd() * .8, vx: (rnd() - .5) * 260, vy: -160 - rnd() * 200, col: cols[i % cols.length], sz: 3 + rnd() * 3, rot: rnd() * 6 });
}
export function drawFx(g, dt, tf) {
  TF = tf;
  for (let i = FXL.length - 1; i >= 0; i--) {
    const e = FXL[i]; e.age += dt;
    if (e.age >= e.life) { FXL.splice(i, 1); continue; }
    const p = e.age / e.life;
    switch (e.k) {
      case 'spark': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 180 * dt; star(g, e.x, e.y, e.sz * (1 - p * .6), e.col, e.rot + e.age * 6); break;
      case 'puff': e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= .94; e.vy *= .94; { g.save(); g.globalAlpha = (1 - p) * .85; const h = hd(g, e.x * .3 + e.y * .5, 14); g.fillStyle = e.col; g.strokeStyle = INK; g.lineWidth = 1.2; h.lineWidth = 1.2; h.beginPath(); h.arc(e.x, e.y, e.sz * (.6 + p * .9), 0, 7); h.fill(); h.stroke(); g.restore(); break; }
      case 'sp': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 90 * dt; e.vx *= .985; g.save(); g.globalAlpha = Math.min(1, (1 - p) * 1.6); skinPart(g, e.shape, e.x, e.y, e.col, e.sz * (1 - p * .4), e.rot + e.age * 5); g.restore(); break;
      case 'ring': g.save(); g.globalAlpha = 1 - p; ringJ(g, e.x, e.y, e.r * (.25 + .75 * Math.sqrt(p)), 4 * (1 - p) + .8, e.col, tf, 3); g.restore(); break;
      case 'star': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 140 * dt; star(g, e.x, e.y, e.sz, '#ffd45a', e.age * 5); break;
      case 'conf': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 380 * dt; e.vx *= .985; g.save(); g.translate(e.x, e.y); g.rotate(e.rot + e.age * 8); g.globalAlpha = Math.min(1, (1 - p) * 2); { const h = hd(g, e.rot * 9 + e.sz, 14); g.fillStyle = e.col; g.strokeStyle = INK; g.lineWidth = 1; h.lineWidth = 1; h.beginPath(); h.rect(-e.sz, -e.sz * .6, e.sz * 2, e.sz * 1.2); h.fill(); h.stroke(); g.restore(); break; }
      case 'plus': e.y += e.vy * dt; { g.save(); g.globalAlpha = 1 - p; const h = hd(g, e.x * .2 + e.y, 14); g.strokeStyle = '#2f9a3a'; g.lineWidth = 2.6; h.lineWidth = 2.6; h.beginPath(); h.moveTo(e.x - 4, e.y); h.lineTo(e.x + 4, e.y); h.moveTo(e.x, e.y - 4); h.lineTo(e.x, e.y + 4); h.stroke(); g.restore(); break; }
      case 'num': {
        const yy = e.y - p * 22 - Math.sin(Math.min(1, p * 4) * 3.14) * 4, sc = p < .15 ? 1 + (.15 - p) * 4 : 1;
        g.save(); g.globalAlpha = p > .7 ? (1 - p) / .3 : 1; g.translate(e.x, yy); g.scale(sc, sc);
        g.font = e.sz + 'px "Caveat Brush", "Comic Sans MS", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 3.4; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(e.txt, 0, 0); g.fillStyle = e.col; g.fillText(e.txt, 0, 0); g.restore(); break;
      }
    }
  }
}
// Lebensbalken über dem Ball
export function drawHpBar(g, b, myTeam, colMine, colFoe, teamCols) {
  const w = Math.max(22, b.r * 1.7), h = 4.4, x = b.x - w / 2, y = b.y - b.r - 10, bm = b.barMax || b.maxHp, fr = Math.max(0, Math.min(1, b.hp / bm)), base = b.maxHp / bm;
  // Handgezeichnet: leicht schiefer Rahmen (pro Ball stabil), Füllung mit Buntstift-Schraffur
  const j = n => Math.sin(b.id * 12.9 + n * 78.2) * .9;
  const frame = () => { g.beginPath(); g.moveTo(x + j(1), y + j(2)); g.lineTo(x + w + j(3), y + j(4) * .6); g.lineTo(x + w + j(5), y + h + j(6)); g.lineTo(x + j(7), y + h + j(8) * .6); g.closePath(); };
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; frame(); g.fillStyle = '#f6efd9'; g.fill();
  if (fr > 0) {
    g.save(); frame(); g.clip(); const fw = w * fr; g.fillStyle = teamCols ? teamCols[b.team] : b.team === myTeam ? colMine : colFoe; g.fillRect(x, y, Math.min(fw, w * base), h);
    if (fr > base) { g.fillStyle = '#ffd21f'; g.fillRect(x + w * base, y, fw - w * base, h); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); for (let sx = x - h; sx < x + fw; sx += 3.2) { g.moveTo(sx, y + h); g.lineTo(sx + h, y); } g.stroke();
    g.strokeStyle = INK; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + fw + j(9) * .5, y); g.lineTo(x + fw + j(10) * .5, y + h); g.stroke(); g.restore();
  }
  g.strokeStyle = INK; g.lineWidth = 1.6; frame(); g.stroke(); g.restore();
}
