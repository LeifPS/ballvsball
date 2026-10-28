// Ballbox-Minispiel: 10 Bälle fallen mit Schwerkraft in eine Schüssel, wer zuerst
// durch die Öffnung unten fällt, wird der Gewinn. Deterministisch (wie core.js).
import { mulberry } from './core.js';

export const BW = 300, BH = 440, BR = 12, EXIT_Y = 405, BDT = 1 / 120;
export const POUR_START = 60;   // ab diesem Schritt kommen die Bälle aus der gekippten Box
const GRAV = 230, MAXV = 300, MAX_STEPS = 120 * 18;

// Wände als Strecken [x1,y1,x2,y2]
export const SEGS = [
  [0, -400, 0, 175], [BW, -400, BW, 175],
  [0, 175, 135, 372], [BW, 175, BW - 135, 372]
];
// [x, y, Radius, Art]: 0 = normaler Nagel, 1 = Bumper (federt Bälle kräftig weg)
// Ablagen an den schrägen Wänden: wer an der Wand herunterrutscht, wird nach innen geleitet und fällt am Innenende ab (kein enger Spalt, nichts klemmt)
export const SHELVES = [
  [59.6, 262, 108, 278], [240.4, 262, 192, 278],
  [103, 325, 122, 336], [197, 325, 178, 336]
];
export const PEGS = [
  // Nagelbrett oben (Abstand zur Wand immer größer als ein Ball)
  [60, 40, 6], [120, 40, 6], [180, 40, 6], [240, 40, 6],
  [38, 85, 6], [90, 85, 6], [150, 85, 6, 1], [210, 85, 6], [262, 85, 6],
  [60, 130, 6], [120, 130, 6], [180, 130, 6], [240, 130, 6],
  [90, 170, 6], [210, 170, 6]
];
// Windrad in der Schüssel: dreht sich mit fester Geschwindigkeit, schleudert Bälle zur Seite
export const SPINNERS = [{ x: 150, y: 212, len: 34, w: 4.5, om: 2.4 }];


/* ---------- Dropper-Formen ---------- */
// Ein Dropper wird als einfache Beschreibung (def) gespeichert und mit buildLayout() zum fertigen Layout. Das macht auch der Dropper-Editor (public/editor).
// def: shape {sh, half} (Schulterhöhe der Wand, halbe Ausgangsbreite), pegs [x,y,r,art], segs (zusätzliche Wände), shelves, spinners, flum [x,y,r],
// grates [[x0,y0,x1,y1]] (schlucken Bälle), cups [{x0,y0,x1,y1}] (Fangkörbe), cannons [{x0,y0,x1,y1,tx,ty,pw}], wind [{x0,y0,x1,y1,ax,ay}],
// grids [[x0,y0,x1,y1]] (Gitterablagen, Strecke mit Platte), blocks [[x0,y0,x1,y1]] (feste Rechtecke)
export function makeShape(sh, half) {
  const cx = BW / 2, x0 = cx - half, x1 = cx + half;
  if (sh >= 372) {   // gerade Wände, unten Boden mit Ausgangslücke
    return {
      segs: [[0, -400, 0, 372], [BW, -400, BW, 372], [0, 372, x0, 372], [BW, 372, x1, 372], [x0, 372, x0, 392], [x1, 372, x1, 392]],
      poly: [[0, -400], [BW, -400], [BW, 372], [x1, 372], [x1, 392], [x0, 392], [x0, 372], [0, 372]],
      outline: [[[0, -400], [0, 372], [x0, 372], [x0, 392]], [[BW, -400], [BW, 372], [x1, 372], [x1, 392]]]
    };
  }
  return {   // Trichter: ab der Schulter schräg zum Ausgang
    segs: [[0, -400, 0, sh], [BW, -400, BW, sh], [0, sh, x0, 372], [BW, sh, x1, 372]],
    poly: [[0, -400], [BW, -400], [BW, sh], [x1, 372], [x1, 392], [x0, 392], [x0, 372], [0, sh]],
    outline: [[[0, -400], [0, sh], [x0, 372], [x0, 392]], [[BW, -400], [BW, sh], [x1, 372], [x1, 392]]]
  };
}
export function buildLayout(def) {
  const sh = def.shape || { sh: 175, half: 15 }, S = makeShape(sh.sh, sh.half), cups = def.cups || [], grates = def.grates || [], grids = def.grids || [], blocks = def.blocks || [];
  const cupSegs = c => [[c.x0, c.y0 - 4, c.x0, c.y1], [c.x0, c.y1, c.x1, c.y1], [c.x1, c.y1, c.x1, c.y0 - 4]];
  const rectSegs = r => [[r[0], r[1], r[2], r[1]], [r[2], r[1], r[2], r[3]], [r[2], r[3], r[0], r[3]], [r[0], r[3], r[0], r[1]]];
  const goalX = sh.sh >= 372 ? sh.half * 2 + 6 : sh.half * 2;
  return {
    id: def.id || 'eigen', def,
    segs: S.segs.concat(def.segs || [], ...grids.map(g => [g]), ...blocks.map(rectSegs), ...cups.map(cupSegs)),
    shelves: def.shelves || [], pegs: def.pegs || [], spinners: def.spinners || [],
    flum: def.flum || [], cannons: def.cannons || [], wind: def.wind || [], webs: def.webs || [], portals: def.portals || [], theme: def.theme || '',
    traps: grates.map(r => ({ k: 'grate', x0: r[0], y0: r[1], x1: r[2], y1: r[3] })).concat(cups.map(c => ({ k: 'cup', x0: c.x0 + 6, y0: c.y0 + 6, x1: c.x1 - 6, y1: c.y1 - 3 }))),
    cups, grates, grids, blocks,
    poly: S.poly, outline: S.outline, goal: [BW / 2 - goalX / 2, 330, goalX, 70]
  };
}
// Gefühlsbox: Dropper aus dem Editor (von Erik und Thore gebaut): Gitterablagen oben, Propeller, Flummi und starker Wind an den Seiten unten
const FEEL_DEF = {
  id: 'gefuehl', shape: { sh: 175, half: 15 },
  spinners: [{ x: 122, y: 200, len: 44, w: 4.5, om: 0.3 }],
  flum: [[208, 200, 14]],
  wind: [{ x0: 48, y0: 240, x1: 136, y1: 402, ax: -5000, ay: -40 }, { x0: 164, y0: 236, x1: 254, y1: 402, ax: 5000, ay: -40 }, { x0: 256, y0: 162, x1: 300, y1: 236, ax: -500, ay: 0 }, { x0: -2, y0: 160, x1: 46, y1: 242, ax: 500, ay: 0 }],
  grids: [[0, 40, 100, 60], [200, 60, 302, 38]]
};
// Halloween-Dropper: Friedhof bei Nacht. Grabsteine als Nägel, Kerzen als rote Bumper, Kürbis-Flummis, eine Fledermaus als Propeller, Spinnennetze bremsen, Geister-Portale versetzen, der Hexenkessel fängt Bälle
const HALLOW_PEGS = [[40, 40, 6, 0], [100, 30, 6, 0], [160, 42, 6, 0], [222, 30, 6, 0], [266, 62, 6, 0], [70, 92, 6, 0], [130, 84, 6, 1], [190, 92, 6, 0], [248, 118, 6, 0], [30, 148, 6, 0], [100, 150, 6, 0], [160, 156, 6, 1], [268, 170, 6, 0], [60, 214, 6, 0], [232, 226, 6, 0]];
const HALLOW_DEF = {
  id: 'halloween', theme: 'halloween', shape: { sh: 200, half: 16 }, pegs: HALLOW_PEGS,
  flum: [[78, 190, 15], [222, 176, 15]],
  spinners: [{ x: 150, y: 232, len: 42, w: 4.5, om: 1.8 }],
  webs: [{ x: 52, y: 118, r: 30 }, { x: 246, y: 66, r: 30 }],
  portals: [{ ax: 72, ay: 276, bx: 228, by: 266, r: 15 }],
  cups: [{ x0: 108, y0: 304, x1: 144, y1: 328 }]
};
const STD_DEF = { id: 'standard', shape: { sh: 175, half: 15 }, pegs: PEGS, shelves: SHELVES, spinners: SPINNERS };
export const DEFS_DROPPER = { standard: STD_DEF, gefuehl: FEEL_DEF, halloween: HALLOW_DEF };
export const LAYOUTS = { standard: buildLayout(STD_DEF), gefuehl: buildLayout(FEEL_DEF), halloween: buildLayout(HALLOW_DEF) };
export const layoutOf = id => LAYOUTS[id] || LAYOUTS.standard;

export function createBox(seed, n, layout) {
  const rng = mulberry(seed >>> 0);
  const balls = [];
  // Die Box wird oben ausgeschüttet: die Bälle kommen nacheinander aus dem Rand der gekippten Box (links von der Mitte)
  for (let i = 0; i < n; i++) {
    balls.push({
      x: 138 + (rng() - .5) * 22, y: -74 - rng() * 8,
      vx: 10 + rng() * 85, vy: 15 + rng() * 25, rot: rng() * 6.28, vr: (rng() - .5) * 6,
      spawn: POUR_START + Math.round(i * 4 + rng() * 4), on: false, done: false
    });
  }
  return { n, rng, balls, step: 0, t: 0, order: [], times: [], done: false, L: layout || LAYOUTS.standard };
}

function hitPoint(b, px, py, rad, e) {
  const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, rr = BR + rad;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || .0001, nx = dx / d, ny = dy / d;
  b.x = px + nx * rr; b.y = py + ny * rr;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    b.vx *= .985; b.vy *= .985;
    b.vr += (b.vx * ny - b.vy * nx) * .008;
  }
}
function hitSeg(b, s, e) {
  const ax = s[0], ay = s[1], dx = s[2] - ax, dy = s[3] - ay, l2 = dx * dx + dy * dy;
  let t = ((b.x - ax) * dx + (b.y - ay) * dy) / l2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  hitPoint(b, ax + dx * t, ay + dy * t, 0, e);
}

function hitSegW(b, sg, e, sp) {
  const ax = sg[0], ay = sg[1], dx = sg[2] - ax, dy = sg[3] - ay, l2 = dx * dx + dy * dy;
  let t = ((b.x - ax) * dx + (b.y - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t, py = ay + dy * t, ddx = b.x - px, ddy = b.y - py, rr = BR + sp.w;
  if (ddx * ddx + ddy * ddy >= rr * rr) return;
  const d = Math.sqrt(ddx * ddx + ddy * ddy) || .0001, nx = ddx / d, ny = ddy / d;
  b.x = px + nx * rr; b.y = py + ny * rr;
  // Geschwindigkeit des Balkens an der Berührstelle (Drehung um die Nabe)
  const wx = -(py - sp.y) * sp.om, wy = (px - sp.x) * sp.om, vn = (b.vx - wx) * nx + (b.vy - wy) * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
}
export function stepBox(s) {
  if (s.done) return;
  s.step++; s.t = s.step * BDT;
  const B = s.balls, L = s.L;
  // gelegentlicher kleiner Stoß gegen Verklemmen (deterministisch)
  if (s.step % 120 === 0) {
    for (const b of B) if (!b.done && !b.out && b.on && b.y > 100 && b.y < 380) { b.vx += (s.rng() - .5) * 50; b.vy -= s.rng() * 25; }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!b.on) { if (s.step >= b.spawn) b.on = true; else continue; }
    if (b.done || b.out === 'grate') { b.vy += GRAV * BDT; b.y += b.vy * BDT; continue; }
    if (b.out) continue;   // im Korb gefangen
    b.vy += GRAV * BDT;
    if (b.vy > MAXV) b.vy = MAXV;
    b.x += b.vx * BDT; b.y += b.vy * BDT;
    b.vr *= .985; if (b.vr > 4) b.vr = 4; else if (b.vr < -4) b.vr = -4;   // Drehung klingt ab, bleibt ruhig
    b.rot += b.vr * BDT;
    for (const sg of L.segs) hitSeg(b, sg, .35);
    for (const sg of L.shelves) hitSeg(b, sg, .3);
    for (const p of L.pegs) hitPoint(b, p[0], p[1], p[2], p[3] ? .95 : .45);
    if (L.webs) for (const w of L.webs) { const dx = b.x - w.x, dy = b.y - w.y; if (dx * dx + dy * dy < w.r * w.r) { b.vx *= .94; b.vy *= .94; b.web = s.step; } }   // Spinnennetz: bremst
    if (L.portals) for (const p of L.portals) {
      if (s.step - (b.pt || -999) < 90) continue;
      for (let k = 0; k < 2; k++) {
        const fx0 = k ? p.bx : p.ax, fy0 = k ? p.by : p.ay, dx = b.x - fx0, dy = b.y - fy0;
        if (dx * dx + dy * dy < p.r * p.r) { b.x = k ? p.ax : p.bx; b.y = (k ? p.ay : p.by) + 4; b.pt = s.step; p.hit = s.step; if (s.ev) s.ev.push('portal'); break; }
      }
    }
    if (L.flum) for (const f of L.flum) { if (s.ev) { const fx0 = b.x - f[0], fy0 = b.y - f[1], rr0 = BR + f[2] + 1; if (fx0 * fx0 + fy0 * fy0 < rr0 * rr0 && s.step - (b.boing || -99) > 12) { s.ev.push('boing'); b.boing = s.step; } } hitPoint(b, f[0], f[1], f[2], 1.12); }
    if (L.wind) for (const w of L.wind) if (b.x > w.x0 && b.x < w.x1 && b.y > w.y0 && b.y < w.y1) { b.vx += w.ax * BDT; b.vy += w.ay * BDT; }
    if (L.cannons) for (const c of L.cannons) {
      if (b.x > c.x0 && b.x < c.x1 && b.y > c.y0 && b.y < c.y1) {
        if (!b.cn) b.cn = s.t;
        b.vx *= .94; b.vy *= .94;
        if (s.t - b.cn > .2) {   // Bumm: Ball wird Richtung (tx, ty) nach oben geschleudert
          const dx = c.tx - b.x, dy = c.ty - b.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
          b.vx = dx / l * c.pw; b.vy = dy / l * c.pw; b.cn = 0; b.fired = s.step; c.fire = s.step; if (s.ev) s.ev.push('cannon');
        }
      } else if (b.cn && !(b.x > c.x0 - 6 && b.x < c.x1 + 6 && b.y > c.y0 - 6 && b.y < c.y1 + 6)) b.cn = 0;
    }
    if (L.traps) for (const tr of L.traps) {
      if (b.x > tr.x0 && b.x < tr.x1 && b.y > tr.y0 && b.y < tr.y1) {
        b.out = tr.k; b.outStep = s.step; if (s.ev) s.ev.push(tr.k === 'cup' ? 'catch' : 'grate');
        if (tr.k === 'cup') { b.vx = b.vy = 0; b.vr = 0; b.cup = tr; }
        else { b.vx *= .3; b.vy = Math.max(b.vy, 60); }
        break;
      }
    }
    for (const sp of L.spinners) {
      const a = s.t * sp.om, ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const dx = ca * sp.len * (k ? 1 : -1) * 1, dy = sa * sp.len * (k ? 1 : -1);
        // Balken als Strecke (Mitte bis Ende) mit Eigengeschwindigkeit: Ball wird mitgerissen
        const seg = [sp.x, sp.y, sp.x + dx, sp.y + dy], vx0 = b.vx, vy0 = b.vy;
        hitSegW(b, seg, .5, sp);
      }
    }
  }
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    if (a.done || !a.on || a.out) continue;
    for (let j = i + 1; j < B.length; j++) {
      const b = B[j];
      if (b.done || !b.on || b.out) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = BR * 2;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || .0001, nx = dx / d, ny = dy / d, over = (rr - d) / 2;
      a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const jn = -(1 + .45) * vn / 2;
        a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
      }
    }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!b.done && !b.out && b.on && b.y > EXIT_Y) { b.done = true; s.order.push(i); s.times.push(s.t); }
  }
  if (s.order.length >= s.n || s.step >= MAX_STEPS || !B.some(b => !b.done && !b.out)) {
    s.done = true; s.reached = s.order.length;
    if (s.order.length < s.n) {
      const rest = [];
      for (let i = 0; i < s.n; i++) if (!B[i].done) rest.push(i);
      rest.sort((p, q) => B[q].y - B[p].y || p - q);
      for (const i of rest) { s.order.push(i); s.times.push(s.t); }
    }
  }
}
// Für den Server: reicht, bis die ersten drei durch sind
export function simBox(seed, n, layout) {
  const s = createBox(seed, n, layout);
  while (!s.done && !(s.order.length >= 3)) stepBox(s);
  const reached = s.done ? s.reached : s.order.length;
  if (!s.done) {
    // Reihenfolge der übrigen nach Höhe für Platz 4+
    const rest = [];
    for (let i = 0; i < n; i++) if (!s.balls[i].done) rest.push(i);
    rest.sort((p, q) => s.balls[q].y - s.balls[p].y || p - q);
    for (const i of rest) { s.order.push(i); s.times.push(s.t); }
  }
  return { order: s.order, times: s.times, steps: s.step, reached };
}
