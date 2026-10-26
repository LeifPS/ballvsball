// Ballbox-Minispiel: 10 Bälle fallen mit Schwerkraft in eine Schüssel, wer zuerst
// durch die Öffnung unten fällt, wird der Gewinn. Deterministisch (wie core.js).
import { mulberry } from './core.js';

export const BW = 300, BH = 440, BR = 12, EXIT_Y = 405, BDT = 1 / 120;
const GRAV = 170, MAXV = 230, MAX_STEPS = 120 * 18;

// Wände als Strecken [x1,y1,x2,y2]
export const SEGS = [
  [0, -400, 0, 175], [BW, -400, BW, 175],
  [0, 175, 135, 372], [BW, 175, BW - 135, 372]
];
export const PEGS = [
  // Nagelbrett oben (Abstand zur Wand immer größer als ein Ball)
  [60, 40, 6], [120, 40, 6], [180, 40, 6], [240, 40, 6],
  [90, 85, 6], [150, 85, 6], [210, 85, 6],
  [60, 130, 6], [120, 130, 6], [180, 130, 6], [240, 130, 6],
  // in der Schüssel
  [150, 205, 7], [92, 258, 6], [208, 258, 6], [150, 305, 6]
];

export function createBox(seed, n) {
  const rng = mulberry(seed >>> 0);
  const balls = [];
  for (let i = 0; i < n; i++) {
    balls.push({
      x: 45 + (((i * 3) % 5) + .5) * 42 + (rng() - .5) * 20, y: -30 - Math.floor(i / 5) * 34 - rng() * 10,
      vx: (rng() - .5) * 70, vy: rng() * 30, rot: rng() * 6.28, vr: (rng() - .5) * 6,
      done: false
    });
  }
  return { n, rng, balls, step: 0, t: 0, order: [], times: [], done: false };
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

export function stepBox(s) {
  if (s.done) return;
  s.step++; s.t = s.step * BDT;
  const B = s.balls;
  // gelegentlicher kleiner Stoß gegen Verklemmen (deterministisch)
  if (s.step % 120 === 0) {
    for (const b of B) if (!b.done && b.y > 100 && b.y < 380) { b.vx += (s.rng() - .5) * 50; b.vy -= s.rng() * 25; }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (b.done) { b.vy += GRAV * BDT; b.y += b.vy * BDT; continue; }
    b.vy += GRAV * BDT;
    if (b.vy > MAXV) b.vy = MAXV;
    b.x += b.vx * BDT; b.y += b.vy * BDT;
    b.vr *= .985; if (b.vr > 4) b.vr = 4; else if (b.vr < -4) b.vr = -4;   // Drehung klingt ab, bleibt ruhig
    b.rot += b.vr * BDT;
    for (const sg of SEGS) hitSeg(b, sg, .35);
    for (const p of PEGS) hitPoint(b, p[0], p[1], p[2], .45);
  }
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    if (a.done) continue;
    for (let j = i + 1; j < B.length; j++) {
      const b = B[j];
      if (b.done) continue;
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
    if (!b.done && b.y > EXIT_Y) { b.done = true; s.order.push(i); s.times.push(s.t); }
  }
  if (s.order.length >= s.n || s.step >= MAX_STEPS) {
    s.done = true;
    if (s.order.length < s.n) {
      const rest = [];
      for (let i = 0; i < s.n; i++) if (!B[i].done) rest.push(i);
      rest.sort((p, q) => B[q].y - B[p].y || p - q);
      for (const i of rest) { s.order.push(i); s.times.push(s.t); }
    }
  }
}
// Für den Server: reicht, bis die ersten drei durch sind
export function simBox(seed, n) {
  const s = createBox(seed, n);
  while (!s.done && !(s.order.length >= 3)) stepBox(s);
  if (!s.done) {
    // Reihenfolge der übrigen nach Höhe für Platz 4+
    const rest = [];
    for (let i = 0; i < n; i++) if (!s.balls[i].done) rest.push(i);
    rest.sort((p, q) => s.balls[q].y - s.balls[p].y || p - q);
    for (const i of rest) { s.order.push(i); s.times.push(s.t); }
  }
  return { order: s.order, times: s.times, steps: s.step };
}
