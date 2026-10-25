// Zeichnen der Bälle, Geschosse und Effekte (Tonlinge-Stil, vorgerenderte Sprites mit 3 Boil-Frames).
import { DEFS } from './engine.js';
import { INK, DPR, mkSprite, spr } from './sk.js';
import { BALLS, OB, PARTS, S0, R0 } from './ballart.js';

const SC = DPR > 1.5 ? 1.35 : 1;
const SIDE = 200;
const BODY = {}, OBJS_SP = {}, PART_SP = {};
const KS = { riese: .87, glas: 1.28, toast: .98, kreisel: .94, ufo: .8 };   // Sprite-Körper passt zum Radius

export function bodySprite(type) {
  return BODY[type] || (BODY[type] = mkSprite('b_' + type, SIDE, S0, BALLS[type], SC));
}
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
export function star(g, x, y, r, col, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); }
  g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = Math.max(1, r * .18); g.strokeStyle = INK; g.stroke(); g.restore();
}


/* ---------- Ball ---------- */
// Koordinaten in Arena-Einheiten; tf = Boil-Frame, tm = Sekunden
export function drawBall(g, b, sim, tf, tm, tint) {
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
  else if (type === 'spinne' && st.th) { for (let i = 0; i < st.th.length; i++) { g.strokeStyle = 'rgba(70,62,54,.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(st.th[i].x - x + Math.sin(tm * 9 + i) * .5, st.th[i].y - y); g.lineTo(0, 0); g.stroke(); } }
  else if (type === 'magnet' && !b.preview) { const ph = (tm * 70) % 190; ringJ(g, 0, 0, ph, 1.1, 'rgba(211,58,58,' + (.35 * (1 - ph / 190)).toFixed(2) + ')', tf, b.id); }
  else if (type === 'supernova' && st.ch > 0) { const rr = b.r * (1.5 + st.ch * 2), gr = g.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, 'rgba(255,240,150,' + (.15 + st.ch * .5) + ')'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill(); }
  else if (type === 'schwarzloch') { ringJ(g, 0, 0, 38 + Math.sin(tm * 3) * 4, 1.2, 'rgba(139,79,201,.4)', tf, b.id); }
  else if (type === 'tornado') { const p = partSprite('swirl'); spr(g, p, 0, 0, f, (b.r + 14) / p.rad, tm * 4, .55); }
  /* Körper */
  g.save(); g.rotate(tilt); g.scale(sx * bob * k, sy * bob * k);
  const sp = bodySprite(type);
  g.drawImage(sp.fr[((f % 3) + 3) % 3], -sp.side / 2, -sp.side / 2, sp.side, sp.side);
  const fl = (b.flash > 0 ? b.flash * 6 : 0) + (tint || 0);
  if (fl > 0) {
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = Math.min(.8, fl);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R0 * 1.7, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.globalAlpha = ghost ? .45 : 1;
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
    for (let i = 0; i < 4; i++) { const a = tm * 12 + i * 1.57; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, b.r + 12, a, a + .5); g.stroke(); }
  } else if (type === 'pfanne') {
    const a = st.ang || 0; spr(g, partSprite('pan'), Math.cos(a) * (b.r + 10), Math.sin(a) * (b.r + 10), f, .85, a);
  } else if (type === 'drache' && st.breath > 0) {
    const ax = st.ax, ay = st.ay, p = objSprite('fireZone');
    for (let i = 0; i < 9; i++) { const dist = b.r + 8 + i * 15, w = .45 + i * .1; spr(g, p, ax * dist, ay * dist, f + i, w * (.9 + .15 * Math.sin(tm * 14 + i)), 0, .88); }
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
  ctx.drawImage(sp.fr[((tf % 3) + 3) % 3], -w / 2, -w / 2, w, w);
  ctx.restore();
}

/* ---------- Geschosse, Fallen, Zonen ---------- */
const WAVE_COL = { shock: ['#9ad8ff', '#ffffff'], nova: ['#ffe14a', '#fff6c0'], quake: ['#a58862', '#d8c29a'], flame: ['#ff8a2a', '#ffd24a'], phase: ['#b46af0', '#f0d8ff'], ult: ['#ffc21a', '#fff6c0'] };
const ZONE = { rain: 'rainZone', lava: 'lavaZone', dust: 'dustZone', egg: 'eggZone', platte: 'platteZone', brew: 'brewZone' };
export const GROUND = { puddle: 1, fire: 1, spike: 1, bomb: 1, meteor: 1, mine: 1, wave: 1 };
export function drawObj(g, o, sim, tf, tm) {
  const f = tf + (o.owner || 0) * 3;
  switch (o.k) {
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
      if (o.vis === 'rain') for (let i = 0; i < 4; i++) { const ph = (tm * 2 + i * .3 + o.x) % 1; g.strokeStyle = 'rgba(80,150,220,.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(o.x - o.r * .5 + i * o.r * .35, o.y - 26 + ph * 26); g.lineTo(o.x - o.r * .5 + i * o.r * .35 - 1.5, o.y - 18 + ph * 26); g.stroke(); }
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
    snd('die');
  } else if (k === 'heal') {
    for (let i = 0; i < 2; i++) pt({ k: 'plus', x: x + (rnd() - .5) * 16, y, age: 0, life: .8, vy: -22 });
    if (e.a >= 3) pt({ k: 'num', x, y: y - 14, age: 0, life: .8, txt: '+' + Math.round(e.a), sz: 10, col: '#6fdc7a' });
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
}
export function burst(x, y, n, cols) {   // Konfetti für Sieg
  for (let i = 0; i < n; i++) pt({ k: 'conf', x: x + (rnd() - .5) * 40, y, age: 0, life: 1.6 + rnd() * .8, vx: (rnd() - .5) * 260, vy: -160 - rnd() * 200, col: cols[i % cols.length], sz: 3 + rnd() * 3, rot: rnd() * 6 });
}
export function drawFx(g, dt, tf) {
  for (let i = FXL.length - 1; i >= 0; i--) {
    const e = FXL[i]; e.age += dt;
    if (e.age >= e.life) { FXL.splice(i, 1); continue; }
    const p = e.age / e.life;
    switch (e.k) {
      case 'spark': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 180 * dt; star(g, e.x, e.y, e.sz * (1 - p * .6), e.col, e.rot + e.age * 6); break;
      case 'puff': e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= .94; e.vy *= .94; g.save(); g.globalAlpha = (1 - p) * .85; g.fillStyle = e.col; g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(e.x, e.y, e.sz * (.6 + p * .9), 0, 7); g.fill(); g.stroke(); g.restore(); break;
      case 'ring': g.save(); g.globalAlpha = 1 - p; ringJ(g, e.x, e.y, e.r * (.25 + .75 * Math.sqrt(p)), 4 * (1 - p) + .8, e.col, tf, 3); g.restore(); break;
      case 'star': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 140 * dt; star(g, e.x, e.y, e.sz, '#ffd45a', e.age * 5); break;
      case 'conf': e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 380 * dt; e.vx *= .985; g.save(); g.translate(e.x, e.y); g.rotate(e.rot + e.age * 8); g.globalAlpha = Math.min(1, (1 - p) * 2); g.fillStyle = e.col; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.rect(-e.sz, -e.sz * .6, e.sz * 2, e.sz * 1.2); g.fill(); g.stroke(); g.restore(); break;
      case 'plus': e.y += e.vy * dt; g.save(); g.globalAlpha = 1 - p; g.strokeStyle = '#2f9a3a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(e.x - 4, e.y); g.lineTo(e.x + 4, e.y); g.moveTo(e.x, e.y - 4); g.lineTo(e.x, e.y + 4); g.stroke(); g.restore(); break;
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
export function drawHpBar(g, b, myTeam, colMine, colFoe) {
  const w = Math.max(22, b.r * 1.7), h = 4.4, x = b.x - w / 2, y = b.y - b.r - 10, fr = Math.max(0, Math.min(1, b.hp / b.maxHp));
  g.save(); g.fillStyle = '#f6efd9'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.rect(x, y, w, h); g.fill();
  g.fillStyle = b.team === myTeam ? colMine : colFoe; g.fillRect(x + .5, y + .5, (w - 1) * fr, h - 1); g.beginPath(); g.rect(x, y, w, h); g.stroke(); g.restore();
}
