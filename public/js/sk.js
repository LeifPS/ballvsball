// Tonlinge-Zeichenstil: sketchCtx verwackelt jeden Pfad, doppelte Kontur, versetzte Füllung.
export const INK = '#1d2742';
export const PAPER = '#f6efd9';
export const DPR = Math.min(2.5, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));

export function sketchCtx(c, seed, s, amin) {
  let subs = [], cur = null, lx = 0, ly = 0; const seg = s * .07, amp = Math.max(amin == null ? .7 : amin, s * .02), TAU = Math.PI * 2;
  const add = (x, y) => { if (!cur) { cur = { p: [], closed: false }; subs.push(cur); } cur.p.push([x, y]); lx = x; ly = y; };
  const line = (x, y) => { if (!cur) return add(x, y); const n = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / seg)), x0 = lx, y0 = ly; for (let i = 1; i <= n; i++) add(x0 + (x - x0) * i / n, y0 + (y - y0) * i / n); };
  const nz = (i, k) => Math.sin(i * .85 + seed * 12.9 + k * 3.1) * .62 + Math.sin(i * 2.1 + seed * 7.3 + k) * .38;
  const emit = (k, a, ox, oy) => { for (const sb of subs) { if (sb.p.length < 2) continue; c.beginPath(); sb.p.forEach((p, i) => { const x = p[0] + nz(i, k) * a + ox, y = p[1] + nz(i + 40, k) * a + oy; i ? c.lineTo(x, y) : c.moveTo(x, y); }); if (sb.closed) c.closePath(); } };
  const arcPts = (x, y, rx, ry, rot, a0, a1, ccw) => {
    let d = a1 - a0; if (!ccw) { while (d < 0) d += TAU; if (d > TAU) d = TAU; } else { while (d > 0) d -= TAU; if (d < -TAU) d = -TAU; }
    const n = Math.max(10, Math.ceil(Math.abs(d) * Math.max(rx, ry) / seg)), co = Math.cos(rot), si = Math.sin(rot);
    for (let i = 0; i <= n; i++) { const a = a0 + d * i / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry, X = x + px * co - py * si, Y = y + px * si + py * co; i === 0 ? line(X, Y) : add(X, Y); }
    if (Math.abs(d) >= TAU - .01 && cur) cur.closed = true;
  };
  const O = {
    beginPath() { subs = []; cur = null; },
    moveTo(x, y) { cur = null; add(x, y); },
    lineTo: line,
    quadraticCurveTo(cx, cy, x, y) { const x0 = lx, y0 = ly, n = Math.max(4, Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)) / seg)); for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; add(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); } },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { const x0 = lx, y0 = ly, n = Math.max(5, Math.ceil((Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y)) / seg)); for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; add(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y); } },
    arc(x, y, r, a0, a1, ccw) { arcPts(x, y, r, r, 0, a0, a1, ccw); },
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) { arcPts(x, y, rx, ry, rot, a0, a1, ccw); },
    rect(x, y, w, h) { cur = null; add(x, y); line(x + w, y); line(x + w, y + h); line(x, y + h); O.closePath(); },
    roundRect(x, y, w, h) { O.rect(x, y, w, h); },
    closePath() { if (cur && cur.p.length) { cur.closed = true; const f = cur.p[0]; lx = f[0]; ly = f[1]; } },
    fill() { const lw = c.lineWidth; emit(3, amp * .8, lw * .45, lw * .4); c.fill(); },
    stroke() { const lw = c.lineWidth; emit(1, amp, 0, 0); c.stroke(); c.save(); c.globalAlpha *= .5; c.lineWidth = Math.max(1, lw * .5); emit(2, amp * 1.3, lw * .3, -lw * .25); c.stroke(); c.restore(); },
    clip() { emit(1, amp * .5, 0, 0); c.clip(); }
  };
  return new Proxy(c, { get(t, p) { if (p in O) return O[p]; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; }, set(t, p, v) { t[p] = v; return true; } });
}
export const strSeed = str => [...str].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) / 97;
export const hexA = (h, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
export const FS = (c, col) => { c.fillStyle = col; c.fill(); c.stroke(); };
export function cEye(c, x, y, r, bl, s) { const lw = c.lineWidth; c.lineWidth = Math.max(1.3, s * .03); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, r, r * bl, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.ellipse(x + r * .15, y + r * .05, r * .52, r * .62 * bl, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * .12, y - r * .22 * bl, r * .18, 0, 7); c.fill(); c.lineWidth = lw; }
export function cBlush(c, x, y, s, a) { c.fillStyle = 'rgba(255,120,120,' + (a || .35) + ')'; c.beginPath(); c.arc(x, y, s * .045, 0, 7); c.fill(); }

/* ---------- Sprites mit 3 Zeichen-Frames (Boil) ---------- */
// fn(c, s): zeichnet um (0,0). side = Kantenlänge in px, s = Bezugsgröße für Strichstärke
export function mkSprite(key, side, s, fn, scale) {
  const sc = scale || 1, fr = [], px = Math.ceil(side * sc);
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(side / 2, side / 2);
    x.lineJoin = x.lineCap = 'round'; x.lineWidth = Math.max(1.6, s * .06); x.strokeStyle = INK;
    const sk = sketchCtx(x, strSeed(key) + f * 1.713, s); sk.lineWidth = x.lineWidth;
    fn(sk, s);
    fr.push(cv);
  }
  return { fr, side, sc };
}
export function spr(g, sp, x, y, tf, scale, rot, alpha, flip) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1);
  if (alpha != null) g.globalAlpha *= alpha;
  const w = sp.side * (scale || 1);
  g.drawImage(sp.fr[((tf % 3) + 3) % 3], -w / 2, -w / 2, w, w);
  g.restore();
}

/* ---------- Handgezeichnete Symbole (statt Emojis) ---------- */
function glyphDraw(c, kind, fill) {
  const F = col => { c.fillStyle = col; c.fill(); c.stroke(); };
  switch (kind) {
    case 'coin': c.beginPath(); c.arc(20, 20, 14, 0, 7); F(fill || '#ffd45a'); c.beginPath(); c.arc(20, 20, 8, 0, 7); c.lineWidth = 2; c.stroke(); c.lineWidth = 3; break;
    case 'token': c.beginPath(); c.ellipse(20, 23, 15, 12.5, 0, 0, 7); F(fill || '#f58a1f'); c.lineWidth = 2; c.beginPath(); c.moveTo(14, 12); c.quadraticCurveTo(11, 23, 14, 34); c.moveTo(26, 12); c.quadraticCurveTo(29, 23, 26, 34); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(20, 11); c.quadraticCurveTo(21, 5, 26, 4); c.stroke(); break;
    case 'shard': c.beginPath(); c.moveTo(20, 2); c.lineTo(31, 12); c.lineTo(31, 28); c.lineTo(20, 38); c.lineTo(9, 28); c.lineTo(9, 12); c.closePath(); F(fill || '#3d7bff'); c.lineWidth = 2; c.beginPath(); c.moveTo(20, 2); c.lineTo(20, 38); c.moveTo(9, 12); c.lineTo(20, 20); c.lineTo(31, 12); c.moveTo(9, 28); c.lineTo(20, 20); c.lineTo(31, 28); c.stroke(); c.lineWidth = 3; break;
    case 'heart': case 'heart0': c.beginPath(); c.moveTo(20, 34); c.bezierCurveTo(2, 22, 5, 5, 14, 6); c.bezierCurveTo(18, 6, 20, 10, 20, 12); c.bezierCurveTo(20, 10, 22, 6, 26, 6); c.bezierCurveTo(35, 5, 38, 22, 20, 34); c.closePath(); if (kind === 'heart') F(fill || '#e0533a'); else { c.fillStyle = 'rgba(29,39,66,.1)'; c.fill(); c.stroke(); } break;
    case 'sword': c.beginPath(); c.moveTo(8, 32); c.lineTo(28, 8); c.lineTo(33, 7); c.lineTo(32, 12); c.lineTo(12, 34); c.closePath(); F(fill || '#e8edf5'); c.beginPath(); c.moveTo(7, 25); c.lineTo(15, 33); c.stroke(); break;
    case 'star': c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 18; c[i ? 'lineTo' : 'moveTo'](20 + Math.cos(a) * r, 21.5 + Math.sin(a) * r); } c.closePath(); F(fill || '#ffd45a'); break;
    case 'lock': c.beginPath(); c.rect(9, 18, 22, 17); F(fill || '#f0b84a'); c.beginPath(); c.moveTo(13, 18); c.lineTo(13, 12); c.quadraticCurveTo(20, 2, 27, 12); c.lineTo(27, 18); c.stroke(); break;
    case 'check': c.lineWidth = 9; c.beginPath(); c.moveTo(7, 21); c.lineTo(16, 30); c.lineTo(34, 9); c.stroke(); c.strokeStyle = fill || '#4fc06a'; c.lineWidth = 5; c.stroke(); break;
    case 'cross': c.lineWidth = 9; c.beginPath(); c.moveTo(9, 9); c.lineTo(31, 31); c.moveTo(31, 9); c.lineTo(9, 31); c.stroke(); c.strokeStyle = fill || '#e0533a'; c.lineWidth = 5; c.stroke(); break;
    case 'arrow': c.lineWidth = 6; c.beginPath(); c.moveTo(34, 20); c.lineTo(8, 20); c.moveTo(18, 9); c.lineTo(7, 20); c.lineTo(18, 31); c.stroke(); break;
    case 'plus': c.lineWidth = 7; c.beginPath(); c.moveTo(20, 8); c.lineTo(20, 32); c.moveTo(8, 20); c.lineTo(32, 20); c.stroke(); break;
    case 'gear': c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 11 : 17; c[i ? 'lineTo' : 'moveTo'](20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } c.closePath(); F(fill || '#cfd6e4'); c.beginPath(); c.arc(20, 20, 5, 0, 7); c.stroke(); break;
    case 'skip': c.beginPath(); c.moveTo(6, 8); c.lineTo(20, 20); c.lineTo(6, 32); c.closePath(); F('#ffd45a'); c.beginPath(); c.moveTo(20, 8); c.lineTo(34, 20); c.lineTo(20, 32); c.closePath(); F('#ffd45a'); break;
    case 'speaker': c.beginPath(); c.moveTo(6, 15); c.lineTo(13, 15); c.lineTo(23, 7); c.lineTo(23, 33); c.lineTo(13, 25); c.lineTo(6, 25); c.closePath(); F('#e8edf5'); c.lineWidth = 3; c.beginPath(); c.arc(25, 20, 7, -.9, .9); c.moveTo(31, 11); c.quadraticCurveTo(40, 20, 31, 29); c.stroke(); break;
    case 'speaker0': c.beginPath(); c.moveTo(6, 15); c.lineTo(13, 15); c.lineTo(23, 7); c.lineTo(23, 33); c.lineTo(13, 25); c.lineTo(6, 25); c.closePath(); F('#e8edf5'); c.lineWidth = 4; c.beginPath(); c.moveTo(28, 14); c.lineTo(38, 26); c.moveTo(38, 14); c.lineTo(28, 26); c.stroke(); break;
    case 'note': c.beginPath(); c.ellipse(13, 30, 7, 5.2, -.35, 0, 7); F('#ffd45a'); c.beginPath(); c.moveTo(19.5, 28.5); c.lineTo(19.5, 6); c.quadraticCurveTo(27, 10, 31, 20); c.stroke(); break;
    case 'note0': c.beginPath(); c.ellipse(13, 30, 7, 5.2, -.35, 0, 7); F('#d8d4c4'); c.beginPath(); c.moveTo(19.5, 28.5); c.lineTo(19.5, 6); c.quadraticCurveTo(27, 10, 31, 20); c.stroke(); c.strokeStyle = '#e0533a'; c.lineWidth = 4; c.beginPath(); c.moveTo(5, 5); c.lineTo(35, 35); c.stroke(); break;
    case 'search': c.beginPath(); c.arc(17, 17, 10, 0, 7); F('#e8f4fb'); c.lineWidth = 5; c.beginPath(); c.moveTo(25, 25); c.lineTo(34, 34); c.stroke(); break;
    case 'crown': c.beginPath(); c.moveTo(6, 30); c.lineTo(4, 12); c.lineTo(13, 20); c.lineTo(20, 8); c.lineTo(27, 20); c.lineTo(36, 12); c.lineTo(34, 30); c.closePath(); F('#ffd45a'); break;
    case 'box': c.beginPath(); c.rect(6, 14, 28, 20); F(fill || '#d9a441'); c.beginPath(); c.rect(4, 8, 32, 8); F(fill || '#e8b85a'); c.beginPath(); c.moveTo(20, 8); c.lineTo(20, 34); c.stroke(); break;
    case 'bx_standard': c.beginPath(); c.rect(6, 17, 28, 18); F('#d9a441'); c.beginPath(); c.rect(4, 11, 32, 8); F('#f0c060'); c.beginPath(); c.moveTo(20, 11); c.lineTo(20, 35); c.lineWidth = 5; c.strokeStyle = '#e0533a'; c.stroke(); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 11); c.quadraticCurveTo(9, 0, 11, 9); c.quadraticCurveTo(14, 12, 20, 11); c.quadraticCurveTo(31, 0, 29, 9); c.quadraticCurveTo(26, 12, 20, 11); F('#e0533a'); break;
    case 'bx_weltraum': c.beginPath(); c.rect(8, 12, 24, 24); F('#3d4aa8'); c.beginPath(); c.ellipse(20, 24, 19, 6, -.25, 0, 7); c.lineWidth = 2.6; c.strokeStyle = '#f4c942'; c.stroke(); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 4); c.lineTo(24, 12); c.lineTo(16, 12); c.closePath(); F('#e0533a'); c.fillStyle = '#fff'; for (const p of [[13, 18], [27, 29], [15, 31]]) { c.beginPath(); c.arc(p[0], p[1], 1.6, 0, 7); c.fill(); } break;
    case 'bx_kueche': c.beginPath(); c.rect(6, 17, 28, 18); F('#e0714f'); c.beginPath(); c.ellipse(20, 17, 15, 4.5, 0, 0, 7); F('#c85a3a'); c.beginPath(); c.moveTo(4, 22); c.lineTo(0, 22); c.moveTo(36, 22); c.lineTo(40, 22); c.lineWidth = 4; c.stroke(); c.lineWidth = 2.4; c.beginPath(); c.moveTo(14, 13); c.quadraticCurveTo(10, 8, 14, 3); c.moveTo(24, 13); c.quadraticCurveTo(20, 8, 24, 3); c.moveTo(31, 12); c.quadraticCurveTo(28, 8, 31, 5); c.stroke(); break;
    case 'bx_sport': c.beginPath(); c.moveTo(5, 18); c.quadraticCurveTo(20, 2, 35, 18); c.closePath(); F('#7ad08e'); c.beginPath(); c.rect(5, 18, 30, 17); F('#4fae6a'); c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.5 : 8; c[i ? 'lineTo' : 'moveTo'](20 + Math.cos(a) * r, 26.5 + Math.sin(a) * r); } c.closePath(); F('#ffd45a'); break;
    case 'bx_elemente': c.beginPath(); c.moveTo(9, 24); c.bezierCurveTo(0, 24, 0, 11, 11, 12); c.bezierCurveTo(12, 3, 28, 3, 29, 12); c.bezierCurveTo(40, 11, 40, 24, 31, 24); c.closePath(); F('#9ad8ff'); c.beginPath(); c.moveTo(22, 20); c.lineTo(15, 30); c.lineTo(20, 30); c.lineTo(17, 38); c.lineTo(27, 27); c.lineTo(22, 27); c.closePath(); F('#ffe14a'); c.beginPath(); c.moveTo(8, 29); c.lineTo(6, 35); c.moveTo(33, 29); c.lineTo(31, 35); c.lineWidth = 3; c.strokeStyle = '#4a8fd0'; c.stroke(); break;
    case 'bx_halloween': c.beginPath(); c.moveTo(20, 9); c.quadraticCurveTo(21, 3, 26, 2); c.lineWidth = 4; c.stroke(); c.lineWidth = 3; c.beginPath(); c.ellipse(20, 23, 17, 13, 0, 0, 7); F('#f58a1f'); c.beginPath(); c.moveTo(20, 10); c.quadraticCurveTo(13, 23, 20, 36); c.lineWidth = 2; c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(9, 19); c.lineTo(15, 19); c.lineTo(12, 14); c.closePath(); F('#ffe14a'); c.beginPath(); c.moveTo(25, 19); c.lineTo(31, 19); c.lineTo(28, 14); c.closePath(); F('#ffe14a'); c.beginPath(); c.moveTo(11, 27); c.lineTo(15, 31); c.lineTo(20, 28); c.lineTo(25, 31); c.lineTo(29, 27); c.lineTo(26, 34); c.lineTo(14, 34); c.closePath(); F('#ffe14a'); break;
    case 'drop': c.beginPath(); c.moveTo(20, 5); c.quadraticCurveTo(34, 22, 28, 30); c.quadraticCurveTo(20, 38, 12, 30); c.quadraticCurveTo(6, 22, 20, 5); F(fill || '#6cc4ee'); break;
    case 'bolt': c.beginPath(); c.moveTo(24, 4); c.lineTo(10, 22); c.lineTo(19, 22); c.lineTo(15, 36); c.lineTo(30, 16); c.lineTo(21, 16); c.closePath(); F(fill || '#ffe14a'); break;
    default: c.beginPath(); c.arc(20, 20, 10, 0, 7); F(fill || '#fff');
  }
}
const GL = new Map();
export function glyphURL(kind, fill) {
  const k = kind + (fill || '');
  let u = GL.get(k);
  if (u) return u;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const x = cv.getContext('2d'); x.scale(96 / 40, 96 / 40); x.lineJoin = x.lineCap = 'round'; x.lineWidth = 3; x.strokeStyle = INK;
    const sk = sketchCtx(x, strSeed('g' + kind), 40); sk.lineWidth = 3;
    glyphDraw(sk, kind, fill);
    u = cv.toDataURL();
  } catch (e) { u = ''; }
  GL.set(k, u);
  return u;
}
export const gi = (kind, size, fill) => '<img class="gi" alt="" src="' + glyphURL(kind, fill) + '" style="width:' + (size || 22) + 'px;height:' + (size || 22) + 'px">';
