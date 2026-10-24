// Stift-Engine: alles wird mit gezeichneten, leicht schiefen Strichen gemalt.
// Jedes Teil (Sprite) hat 3 Zeichen-Frames, die im Wechsel gezeigt werden (leichtes Zittern wie bei Trickfilm).
export const INK = '#2b2118', PAPER = '#fffaf0', BROWN = '#5a4733';
export const DPR = Math.min(3, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
const SS = Math.min(3, DPR * 1.25);   // Sprite-Auflösung

export let g = null;
export function setTarget(c) { const o = g; g = c; return o; }

export function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hex2(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
export function mix(h, t) { const a = hex2(h), b = [255, 250, 240]; return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; }
// Z.s = fester Charakter der Zeichnung, Z.f = kleine Abweichung je Zeichen-Frame
export function Zmk(sid, f) { return { s: mulberry(sid * 7919 + 13), f: mulberry((f + 1) * 104729 + sid * 31 + 7) }; }

export function spline(C) {
  const out = [], n = C.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(n - 1, i + 2)];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.ceil(L / 2));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([
        .5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(C[n - 1]); return out;
}
export function pen(P, w, col, Z) {
  const n = P.length; if (n < 2) return;
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = cum[n - 1] || 1, ph = Z.s() * 6.28, ph2 = Z.s() * 6.28;
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 1; i < n; i++) {
    const t = cum[i] / tot;
    const press = .38 + .62 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * .9 + .05))), .5);
    const wob = 1 + .17 * Math.sin(t * 9 + ph) + .1 * Math.sin(t * 23 + ph2);
    g.lineWidth = Math.max(.6, w * press * wob);
    g.beginPath(); g.moveTo(P[i - 1][0], P[i - 1][1]); g.lineTo(P[i][0], P[i][1]); g.stroke();
  }
}
export function line(Z, x1, y1, x2, y2, w, col, o) {
  o = o || {};
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const ov = o.over == null ? 2.5 : o.over;
  const ov0 = Z.s() * ov, ov1 = Z.s() * ov;
  const bow = (Z.s() - .5) * L * (o.bow == null ? .07 : o.bow);
  const sx = x1 - ux * ov0 + (Z.s() - .5) * 1.2, sy = y1 - uy * ov0 + (Z.s() - .5) * 1.2;
  const ex = x2 + ux * ov1 + (Z.s() - .5) * 1.2, ey = y2 + uy * ov1 + (Z.s() - .5) * 1.2;
  const m = Math.max(2, Math.round(L / 10)), C = [];
  for (let i = 0; i <= m; i++) {
    const t = i / m, b = Math.sin(Math.PI * t) * bow;
    const tr = (i === 0 || i === m) ? 0 : (Z.s() - .5) * .9 + (Z.f() - .5) * .6;
    C.push([sx + (ex - sx) * t + nx * (b + tr), sy + (ey - sy) * t + ny * (b + tr)]);
  }
  pen(spline(C), w, col, Z);
}
export function poly(Z, pts, w, col, closed, o) {
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n]; line(Z, a[0], a[1], b[0], b[1], w, col, o); }
}
export function curve(Z, pts, w, col) {
  const C = pts.map(p => [p[0] + (Z.s() - .5) * .8 + (Z.f() - .5) * .5, p[1] + (Z.s() - .5) * .8 + (Z.f() - .5) * .5]);
  pen(spline(C), w, col, Z);
}
export function lopsided(Z, r, amp) {
  amp = amp || 1;
  const p1 = Z.s() * 6.283, p2 = Z.s() * 6.283, p3 = Z.s() * 6.283;
  const k1 = (.03 + Z.s() * .04) * amp, k2 = (.02 + Z.s() * .03) * amp, k3 = (.01 + Z.s() * .02) * amp;
  return a => r * (1 + k1 * Math.sin(a + p1) + k2 * Math.sin(2 * a + p2) + k3 * Math.sin(3 * a + p3));
}
export function circPoly(rf, cx, cy, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832, rr = rf(a); o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return o; }
export function ring(Z, rf, cx, cy, w, col, o) {
  o = o || {};
  const turns = o.turns || 1.1, N = Math.max(8, Math.round(rf(0) / 2.4)), M = Math.ceil(N * turns), a0 = Z.s() * 6.283, C = [];
  for (let i = 0; i <= M; i++) {
    const a = a0 + i / N * 6.2832, k = i / M;
    const rr = rf(a) * (1 - .06 * k) + (Z.f() - .5) * .6 + (Z.s() - .5) * .5;
    C.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  pen(spline(C), w, col, Z);
}
export function wash(Z, P, col, k) {
  k = k || 3.5;
  g.save(); g.translate((Z.s() - .5) * k, (Z.s() - .5) * k);
  g.beginPath(); P.forEach((p, i) => { const x = p[0] + (Z.s() - .5) * k * .35, y = p[1] + (Z.s() - .5) * k * .35; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath(); g.fillStyle = col; g.fill(); g.restore();
}
export function hatchPoly(Z, P, col, ang, gap, w, o) {
  o = o || {};
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  let mn = 1e9, mx = -1e9;
  P.forEach(p => { const s = p[0] * nx + p[1] * ny; if (s < mn) mn = s; if (s > mx) mx = s; });
  const a = mn + (mx - mn) * (o.from || 0), b = mn + (mx - mn) * (o.to == null ? 1 : o.to);
  for (let s = a + gap * .4; s < b; s += gap * (.7 + Z.s() * .6)) {
    const ts = [];
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length];
      const sa = A[0] * nx + A[1] * ny - s, sb = B[0] * nx + B[1] * ny - s;
      if ((sa < 0) !== (sb < 0)) {
        const f = sa / (sa - sb);
        ts.push((A[0] + (B[0] - A[0]) * f) * dx + (A[1] + (B[1] - A[1]) * f) * dy);
      }
    }
    ts.sort((u, v) => u - v);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      const t0 = ts[k] + (Z.s() - .7) * 3.5, t1 = ts[k + 1] + (Z.s() - .3) * 3.5;
      if (t1 - t0 < 3) continue;
      line(Z, nx * s + dx * t0, ny * s + dy * t0, nx * s + dx * t1, ny * s + dy * t1, w * (.8 + Z.s() * .5), col, { over: 0, bow: .05 });
    }
  }
}
export function marker(Z, x1, y1, x2, y2, w, col) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  for (let k = -1; k <= 1; k++) {
    const off = k * w * .33 + (Z.s() - .5) * 1.2, t0 = Z.s() * 3, t1 = Z.s() * 3;
    line(Z, x1 + ux * t0 + nx * off, y1 + uy * t0 + ny * off, x2 - ux * t1 + nx * off, y2 - uy * t1 + ny * off, w * .55, col, { over: 1, bow: .02 });
  }
}
export function dot(Z, x, y, r, col) {
  g.save(); g.fillStyle = col || INK; g.beginPath();
  g.ellipse(x + (Z.f() - .5) * .4, y, r * (1 + .25 * (Z.s() - .5)), r * (1 + .25 * (Z.s() - .5)), Z.s() * 3, 0, 6.283); g.fill(); g.restore();
}
export function box(Z, x, y, w, h, lw, fillCol, hatchCol) {
  const P = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (fillCol) wash(Z, P, fillCol, 3);
  if (hatchCol) hatchPoly(Z, P, hatchCol, -.8, 6, 2, {});
  line(Z, x, y, x + w, y, lw, INK, { over: 5, bow: .02 });
  line(Z, x + w, y, x + w, y + h, lw, INK, { over: 5, bow: .02 });
  line(Z, x + w, y + h, x, y + h, lw, INK, { over: 5, bow: .02 });
  line(Z, x, y + h, x, y, lw, INK, { over: 5, bow: .02 });
  line(Z, x + 3, y + 1.5, x + Math.max(6, w - 6), y + 2.5, lw * .45, BROWN, { over: 2, bow: .03 });
}

/* ---------- Sprites: 3 Zeichen-Frames ---------- */
function grain(cx, c, id, f) {
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'destination-out';
  const GR = mulberry(id * 17 + f * 5 + 3), cnt = Math.floor(c.width * c.height / 70);
  for (let i = 0; i < cnt; i++) { cx.globalAlpha = .25 + GR() * .35; cx.fillRect(GR() * c.width, GR() * c.height, 1 + GR() * SS, 1 + GR() * SS); }
  cx.restore();
}
export function mkSprite(id, w, h, ox, oy, fn) {
  const fr = [];
  for (let f = 0; f < 3; f++) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS);
    const cx = c.getContext('2d'); cx.scale(SS, SS); cx.translate(ox, oy);
    const old = setTarget(cx); fn(Zmk(id, f)); setTarget(old);
    grain(cx, c, id, f);
    fr.push(c);
  }
  return { fr, w, h, ox, oy };
}
export function spr(sp, x, y, f, sc, rot, alpha) {
  sc = sc || 1;
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (alpha != null) g.globalAlpha = alpha;
  g.drawImage(sp.fr[((f % 3) + 3) % 3], -sp.ox * sc, -sp.oy * sc, sp.w * sc, sp.h * sc);
  g.restore();
}
// Rahmen für Oberflächen (Knöpfe, Karten, ...) in beliebiger Größe, zwischengespeichert
const frCache = new Map();
export function frameSet(kind, w, h, fill, hatch, lw) {
  w = Math.round(w); h = Math.round(h);
  const key = kind + '|' + w + '|' + h + '|' + fill + '|' + hatch;
  let s = frCache.get(key);
  if (!s) {
    const id = hashStr(key) % 100000;
    const M = 8;
    const fr = [];
    for (let f = 0; f < 3; f++) {
      const c = document.createElement('canvas'); c.width = Math.ceil((w + M * 2) * SS); c.height = Math.ceil((h + M * 2) * SS);
      const cx = c.getContext('2d'); cx.scale(SS, SS); cx.translate(M, M);
      const old = setTarget(cx); box(Zmk(id, f), 0, 0, w, h, lw || 2.8, fill, hatch); setTarget(old);
      fr.push(c);
    }
    s = { fr, w: w + M * 2, h: h + M * 2, M };
    if (frCache.size > 400) frCache.clear();
    frCache.set(key, s);
  }
  return s;
}

/* ---------- Text in echter Handschrift ---------- */
const OFF = [[0, 0], [.4, -.3], [-.3, .35]];
export const T = { f: 0 };   // aktueller Zeichen-Frame (0..2)
export function drawText(s, x, y, size, col, align, maxW) {
  g.font = size + 'px Hand';
  const w = g.measureText(s).width;
  if (maxW && w > maxW) { size = size * maxW / w; g.font = size + 'px Hand'; }
  g.textAlign = align || 'center'; g.textBaseline = 'middle';
  const o = OFF[T.f], h = (hashStr(s) % 7) - 3;
  g.save(); g.translate(x + o[0], y + o[1]); g.rotate(h * .004);
  g.fillStyle = col || INK; g.fillText(s, 0, 0); g.restore();
}
