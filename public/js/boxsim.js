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
// Jede Box hat ihren eigenen Dropper. Felder: segs (Wände), shelves (Ablagen), pegs [x,y,r,art], spinners, optional:
// flum [x,y,r] (sehr federnde Riesen-Bumper), traps [{k:'grate'|'cup',x0,y0,x1,y1}] (Gitter schlucken Bälle, Körbe fangen sie),
// cannons [{x0,y0,x1,y1,tx,ty,pw}] (schleudern Bälle nach oben), wind [{x0,y0,x1,y1,ax,ay}], poly/outline fürs Zeichnen.
const FUNNEL = [[0, -400, 0, 175], [BW, -400, BW, 175], [0, 175, 135, 372], [BW, 175, BW - 135, 372]];
const FUNNEL_POLY = [[0, -400], [BW, -400], [BW, 175], [BW - 135, 372], [BW - 135, 392], [135, 392], [135, 372], [0, 175]];
const FUNNEL_LINES = [[[0, -400], [0, 175], [135, 372], [135, 392]], [[BW, -400], [BW, 175], [BW - 135, 372], [BW - 135, 392]]];
// Kleinbox: gerade Wände, unten links und rechts Gitter; rechts darüber zwei Fangkörbe; nur durch die Mitte kommt man zum Becher
const KLEIN_PEGS = [];
for (let r = 0; r < 7; r++) for (let i = 0; i < (r % 2 ? 6 : 7); i++) KLEIN_PEGS.push([(r % 2 ? 48 : 26) + i * 41, 34 + r * 33, 5.5, (r === 3 && (i === 1 || i === 4)) ? 1 : 0]);
const CUPS = [{ k: 'cup', x0: 206, y0: 268, x1: 258, y1: 296 }, { k: 'cup', x0: 236, y0: 322, x1: 290, y1: 350 }];
const cupSegs = c => [[c.x0, c.y0 - 4, c.x0, c.y1], [c.x0, c.y1, c.x1, c.y1], [c.x1, c.y1, c.x1, c.y0 - 4]];
const KLEIN = {
  id: 'klein',
  segs: [[0, -400, 0, 372], [BW, -400, BW, 372], [0, 372, 108, 372], [BW, 372, BW - 108, 372], [108, 372, 108, 392], [BW - 108, 372, BW - 108, 392]].concat(...CUPS.map(cupSegs)),
  shelves: [], pegs: KLEIN_PEGS, spinners: [],
  traps: [{ k: 'grate', x0: 0, y0: 346, x1: 108, y1: 380 }, { k: 'grate', x0: BW - 108, y0: 346, x1: BW, y1: 380 }].concat(CUPS.map(c => ({ k: c.k, x0: c.x0 + 6, y0: c.y0 + 6, x1: c.x1 - 6, y1: c.y1 - 3 }))),
  cups: CUPS, grates: [[0, 346, 108, 380], [BW - 108, 346, BW, 380]],
  poly: [[0, -400], [BW, -400], [BW, 372], [BW - 108, 372], [BW - 108, 392], [108, 392], [108, 372], [0, 372]],
  outline: [[[0, -400], [0, 372], [108, 372], [108, 392]], [[BW, -400], [BW, 372], [BW - 108, 372], [BW - 108, 392]]],
  goal: [108, 330, 84, 70]
};
// Gefühlsbox (nach der Zeichnung von Erik und Thore): Stifte oben, zwei Gitterablagen, Propeller, Flummi, zwei Kanonen und Wind an den Seiten
const FEEL_PEGS = [[62, 52], [100, 84], [128, 40], [172, 46], [150, 88], [212, 28], [250, 30], [214, 68], [258, 78], [62, 8], [150, 8], [96, 160], [150, 168], [206, 160], [60, 190], [240, 188]].map(p => [p[0], p[1], 5.5, 0]);
const FEEL = {
  id: 'gefuehl',
  segs: FUNNEL.concat([
    [22, 104, 118, 134],                              // linke Gitterablage (nach innen geneigt)
    [278, 104, 182, 134],                             // rechte Gitterablage
    [138, 276, 162, 276], [138, 276, 138, 292], [162, 276, 162, 292], [138, 292, 162, 292]   // schmaler Block über dem Ausgang
  ]),
  shelves: [], pegs: FEEL_PEGS, spinners: [{ x: 112, y: 232, len: 44, w: 4.5, om: 2.2 }],
  flum: [[214, 214, 14]],
  cannons: [{ x0: 78, y0: 290, x1: 114, y1: 336, tx: 165, ty: 140, pw: 290, side: 'l' }, { x0: 186, y0: 290, x1: 222, y1: 336, tx: 135, ty: 140, pw: 290, side: 'r' }],
  wind: [{ x0: 104, y0: 338, x1: 134, y1: 384, ax: -330, ay: -40 }, { x0: 166, y0: 338, x1: 196, y1: 384, ax: 330, ay: -40 }],
  grids: [[22, 104, 118, 134], [182, 104, 278, 134]],
  poly: FUNNEL_POLY, outline: FUNNEL_LINES, goal: [135, 330, 30, 70]
};
export const LAYOUTS = {
  standard: { id: 'standard', segs: SEGS, shelves: SHELVES, pegs: PEGS, spinners: SPINNERS, poly: FUNNEL_POLY, outline: FUNNEL_LINES, goal: [135, 330, 30, 70] },
  klein: KLEIN, gefuehl: FEEL
};
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
    if (L.flum) for (const f of L.flum) hitPoint(b, f[0], f[1], f[2], 1.12);
    if (L.wind) for (const w of L.wind) if (b.x > w.x0 && b.x < w.x1 && b.y > w.y0 && b.y < w.y1) { b.vx += w.ax * BDT; b.vy += w.ay * BDT; }
    if (L.cannons) for (const c of L.cannons) {
      if (b.x > c.x0 && b.x < c.x1 && b.y > c.y0 && b.y < c.y1) {
        if (!b.cn) b.cn = s.t;
        b.vx *= .94; b.vy *= .94;
        if (s.t - b.cn > .2) {   // Bumm: Ball wird Richtung (tx, ty) nach oben geschleudert
          const dx = c.tx - b.x, dy = c.ty - b.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
          b.vx = dx / l * c.pw; b.vy = dy / l * c.pw; b.cn = 0; b.fired = s.step; c.fire = s.step;
        }
      } else if (b.cn && !(b.x > c.x0 - 6 && b.x < c.x1 + 6 && b.y > c.y0 - 6 && b.y < c.y1 + 6)) b.cn = 0;
    }
    if (L.traps) for (const tr of L.traps) {
      if (b.x > tr.x0 && b.x < tr.x1 && b.y > tr.y0 && b.y < tr.y1) {
        b.out = tr.k; b.outStep = s.step;
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
