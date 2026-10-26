// Zeichenfunktionen aller Bälle (reine Canvas-Befehle, ohne DOM). Mittelpunkt (0,0), Größe s, Körperradius r = 0.36 s.
import { INK, FS, cEye, cBlush, hexA } from './sk.js';

export const S0 = 76;                // Bezugsgröße der Sprites
export const R0 = S0 * .36;          // Körperradius im Sprite
const PI = Math.PI;

/* ---------- Bausteine ---------- */
function el(c, x, y, rx, ry, col, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 7); FS(c, col); }
function ci(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, 7); FS(c, col); }
function pl(c, pts, col, open) {
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  if (!open) c.closePath();
  if (col) FS(c, col); else c.stroke();
}
function ln(c, x1, y1, x2, y2, w, col) {
  const lw = c.lineWidth, ss = c.strokeStyle;
  if (w) c.lineWidth = w; if (col) c.strokeStyle = col;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.lineWidth = lw; c.strokeStyle = ss;
}
function thick(c, w, col, path) {  // dicke Linie mit Kontur
  const lw = c.lineWidth, ss = c.strokeStyle;
  c.lineWidth = w + lw * 1.6; c.strokeStyle = INK; path(); c.stroke();
  c.lineWidth = w; c.strokeStyle = col; path(); c.stroke();
  c.lineWidth = lw; c.strokeStyle = ss;
}
function dot(c, x, y, r, col) { c.fillStyle = col || INK; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function body(c, s, col, o) {
  o = o || {}; const r = s * .36, rx = r * (o.rx || 1), ry = r * (o.ry || 1);
  el(c, 0, 0, rx, ry, col);
  c.save(); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.clip();
  c.fillStyle = 'rgba(30,30,60,.16)'; c.beginPath(); c.ellipse(r * .28, r * .34, r * 1.05, r * 1.0, 0, 0, 7); c.fill();
  c.fillStyle = col; c.beginPath(); c.ellipse(-r * .05, -r * .08, r * .95, r * .93, 0, 0, 7); c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * .42, -r * .5, r * .16, r * .09, -.7, 0, 7); c.fill();
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.stroke();
  return r;
}
function face(c, s, o) {
  o = o || {}; const r = s * .36, ey = (o.dy == null ? -.08 : o.dy) * r, sp = (o.sp || .36) * r, er = (o.er || .2) * r;
  if (!o.noeyes) [-1, 1].forEach(d => cEye(c, d * sp, ey, er, o.bl || 1, s));
  if (o.angry) { c.lineWidth = s * .05; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * (sp + er * 1.2), ey - er * 1.9); c.lineTo(d * (sp - er * 1.0), ey - er * .9); c.stroke(); }); }
  if (o.sad) { c.lineWidth = s * .05; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * (sp + er * 1.2), ey - er * .9); c.lineTo(d * (sp - er * 1.0), ey - er * 1.9); c.stroke(); }); }
  if (o.blush !== 0) { cBlush(c, -r * .62, ey + r * .42, s); cBlush(c, r * .62, ey + r * .42, s); }
  c.lineWidth = s * .035; c.beginPath();
  const m = o.mouth || 'smile', my = ey + r * .5 + (o.my || 0) * r;
  if (m === 'smile') c.arc(0, my - r * .12, r * .2, .15, PI - .15);
  else if (m === 'flat') { c.moveTo(-r * .2, my); c.lineTo(r * .2, my + 1); }
  else if (m === 'o') c.arc(0, my + r * .05, r * .09, 0, 7);
  else if (m === 'grin') { c.arc(0, my - r * .2, r * .3, .1, PI - .1); c.closePath(); c.fillStyle = '#fff'; c.fill(); }
  else if (m === 'frown') c.arc(0, my + r * .2, r * .18, PI + .3, -.3);
  else if (m === 'fang') { c.arc(0, my - r * .12, r * .22, .15, PI - .15); c.stroke(); [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .12, my + r * .05); c.lineTo(d * r * .2, my + r * .05); c.lineTo(d * r * .16, my + r * .24); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = s * .02; c.stroke(); }); return; }
  c.stroke();
}
function spike(c, x, y, a, l, w, col) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-w, 0); c.lineTo(0, -l); c.lineTo(w, 0); c.closePath(); FS(c, col); c.restore(); }
function glow() { }   // Leuchten hinter den Bällen ist abgeschafft (Aufrufe bleiben als Platzhalter)
function wing(c, d, r, col, o) { o = o || {}; const k = o.k || 1; c.beginPath(); c.moveTo(d * r * .8, -r * .2); c.quadraticCurveTo(d * r * 1.6 * k, -r * 1.2 * k, d * r * 1.7 * k, -r * .1); c.quadraticCurveTo(d * r * 1.4 * k, -r * .3, d * r * 1.25 * k, r * .2); c.quadraticCurveTo(d * r * 1.0 * k, 0, d * r * .8, r * .3); c.closePath(); FS(c, col); }
function stars(c, pts, col) { pts.forEach(p => { c.save(); c.translate(p[0], p[1]); c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, q = i % 2 ? p[2] * .45 : p[2]; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); FS(c, col || '#ffd45a'); c.restore(); }); }
function flame(c, x, y, w, h, col1, col2) {
  c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * .6, y - h * .6, x, y - h); c.quadraticCurveTo(x + w * .2, y - h * .5, x + w, y); c.closePath(); FS(c, col1);
  c.beginPath(); c.moveTo(x - w * .5, y); c.quadraticCurveTo(x - w * .2, y - h * .4, x, y - h * .6); c.quadraticCurveTo(x + w * .2, y - h * .3, x + w * .5, y); c.closePath(); FS(c, col2);
}
function hatch(c, r, col, clip) {  // Streifen im Körper
  c.save(); c.beginPath(); c.arc(0, 0, r * .98, 0, 7); c.clip();
  clip(); c.restore();
}

/* ---------- Die Bälle ---------- */
export const BALLS = {
  /* ===== Standard ===== */
  stachel(c, s) { const r = s * .36; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; spike(c, Math.cos(a) * r * .95, Math.sin(a) * r * .95, a + 1.5708, s * .17, s * .07, '#d6dae2'); } body(c, s, '#e4e1da'); face(c, s, { angry: 1, mouth: 'flat', blush: 0 }); },
  turret(c, s) { const r = s * .36; c.save(); c.rotate(-.5); c.beginPath(); c.rect(r * .6, -s * .06, s * .3, s * .12); FS(c, '#9aa1ad'); c.restore(); body(c, s, '#c4cad4'); face(c, s, {}); },
  ramm(c, s) { const r = s * .36;[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .4, -r * .8); c.quadraticCurveTo(d * r * .9, -r * 1.3, d * r * 1.05, -r * .75); c.lineTo(d * r * .8, -r * .5); c.closePath(); FS(c, '#f3ead2'); }); body(c, s, '#c98b5a', { rx: 1.08, ry: 1.02 }); face(c, s, { angry: 1, mouth: 'frown', er: .17 }); },
  glas(c, s) { c.globalAlpha = .85; body(c, s, '#cbeefa', { rx: .78, ry: .78 }); c.globalAlpha = 1; c.lineWidth = s * .03; c.beginPath(); c.moveTo(s * .03, -s * .22); c.lineTo(s * .09, -s * .08); c.lineTo(s * .02, s * .02); c.stroke(); face(c, s, { mouth: 'o', sp: .38, er: .22 }); },
  feuer(c, s) { const r = s * .36; c.beginPath(); c.moveTo(-r * .5, -r * .6); c.quadraticCurveTo(-r * .3, -r * 1.3, 0, -r * 1.5); c.quadraticCurveTo(r * .1, -r * 1.0, r * .5, -r * .6); c.closePath(); FS(c, '#ffb62e'); body(c, s, '#f26a3a'); face(c, s, { mouth: 'grin' }); },
  bumerang(c, s) {
    const r = s * .36; body(c, s, '#ffe08a');
    thick(c, s * .1, '#b9803a', () => { c.beginPath(); c.moveTo(-r * .85, -r * .72); c.quadraticCurveTo(-r * .1, -r * 1.35, r * .85, -r * .6); });
    face(c, s, { dy: .0 });
  },
  magnet(c, s) {
    const r = s * .36; body(c, s, '#d6d9dc');
    const U = () => { c.beginPath(); c.moveTo(-r * .55, -r * .7); c.lineTo(-r * .55, -r * 1.2); c.quadraticCurveTo(0, -r * 1.7, r * .55, -r * 1.2); c.lineTo(r * .55, -r * .7); };
    thick(c, s * .12, '#d33a3a', U); ln(c, -r * .55, -r * .8, -r * .55, -r * .95, s * .12, '#f2f2f2'); ln(c, r * .55, -r * .8, r * .55, -r * .95, s * .12, '#f2f2f2');
    face(c, s, { dy: -.02 });
  },
  schwert(c, s) { const r = s * .36; c.save(); c.rotate(-.6); c.translate(r * 1.0, 0); c.beginPath(); c.moveTo(0, -s * .04); c.lineTo(s * .28, 0); c.lineTo(0, s * .04); c.closePath(); FS(c, '#eef2f8'); c.beginPath(); c.rect(-s * .02, -s * .1, s * .04, s * .2); FS(c, '#7a4a21'); c.restore(); body(c, s, '#9cc4f2'); c.beginPath(); c.moveTo(-r * .95, -r * .4); c.quadraticCurveTo(0, -r * .55, r * .95, -r * .4); c.lineWidth = s * .06; c.strokeStyle = '#d33a3a'; c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .06; face(c, s, { angry: 1 }); },
  zelle(c, s) {
    const r = s * .36; body(c, s, '#e1d2f3');
    ci(c, r * .12, -r * .08, r * .5, '#b894e3'); dot(c, r * .12, -r * .08, r * .14);
    [[-.55, .4, .16], [.5, .5, .13], [-.45, -.55, .12], [.62, -.4, .09]].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, '#c9aeee'));
    [-1, 1].forEach(d => cEye(c, r * .12 + d * r * .2, -r * .1, r * .13, 1, s));
  },
  spinne(c, s) { const r = s * .36; c.lineWidth = s * .05; for (let i = 0; i < 4; i++)[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .8, (i - 1.5) * r * .35); c.quadraticCurveTo(d * r * 1.4, (i - 1.5) * r * .6 - r * .5, d * r * 1.55, (i - 1.5) * r * .6 + r * .35); c.stroke(); }); body(c, s, '#4b4e5c'); c.lineWidth = s * .06;[-1, 1].forEach(d => cEye(c, d * r * .34, -r * .1, r * .22, 1, s)); c.fillStyle = '#e0453a';[-1, 1].forEach(d => { c.beginPath(); c.arc(d * r * .34, -r * .1, r * .1, 0, 7); c.fill(); }); },
  schmied(c, s) {
    const r = s * .36; body(c, s, '#b58d62');
    pl(c, [[-r * .5, r * .55], [r * .5, r * .55], [r * .4, r * .72], [r * .2, r * .76], [r * .26, r * .95], [-r * .26, r * .95], [-r * .2, r * .76], [-r * .4, r * .72]], '#8a8f99');
    face(c, s, { angry: 1, dy: -.12, mouth: 'flat', my: -.12, blush: 0 });
    pl(c, [[-r * .9, -r * .55], [r * .9, -r * .55], [r * .8, -r * .85], [-r * .8, -r * .85]], '#d33a3a');
  },
  bombe(c, s) {
    const r = s * .36; thick(c, s * .05, '#7a5a3a', () => { c.beginPath(); c.moveTo(0, -r * .95); c.quadraticCurveTo(r * .15, -r * 1.35, r * .5, -r * 1.4); });
    body(c, s, '#4a4f5a'); stars(c, [[r * .62, -r * 1.45, s * .09]], '#ffd45a'); face(c, s, { sad: 1, mouth: 'frown', blush: 0 });
  },
  schild(c, s) {
    const r = s * .36; body(c, s, '#cfd8e6');
    pl(c, [[-r * .95, -r * .5], [-r * .5, -r * .95], [r * .5, -r * .95], [r * .95, -r * .5], [r * .75, -r * .3], [-r * .75, -r * .3]], '#8aa4c8');
    face(c, s, { dy: .02, mouth: 'flat', er: .17, sp: .3, blush: 0 });
  },
  echo(c, s) {
    const r = s * .36; c.globalAlpha = .4; c.lineWidth = s * .035;
    for (let i = 1; i <= 2; i++) { c.beginPath(); c.ellipse(-r * .22 * i, r * .1 * i, r * (1 + .02 * i), r * (1 + .02 * i), 0, 0, 7); c.stroke(); }
    c.globalAlpha = 1; c.lineWidth = s * .06; body(c, s, '#e7dcf6'); face(c, s, { mouth: 'o', er: .21 });
  },
  gift(c, s) {
    const r = s * .36; body(c, s, '#8fd16b');
    [[-.5, -.85, .17], [.2, -1.0, .22], [.62, -.72, .13]].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, '#b7e69a'));
    [[-.7, .72], [.5, .85]].forEach(p => { c.beginPath(); c.moveTo(p[0] * r, p[1] * r); c.quadraticCurveTo(p[0] * r + r * .18, p[1] * r + r * .2, p[0] * r, p[1] * r + r * .32); c.quadraticCurveTo(p[0] * r - r * .18, p[1] * r + r * .2, p[0] * r, p[1] * r); FS(c, '#6fbf3e'); });
    face(c, s, { mouth: 'grin', dy: -.02 });
  },
  vampir(c, s) { const r = s * .36; glow(c, s, '#8b4fc9');[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .8, -r * .2); c.quadraticCurveTo(d * r * 1.6, -r * 1.2, d * r * 1.7, -r * .1); c.quadraticCurveTo(d * r * 1.4, -r * .3, d * r * 1.25, r * .2); c.quadraticCurveTo(d * r * 1.0, 0, d * r * .8, r * .3); c.closePath(); FS(c, '#5a3d78'); }); body(c, s, '#eadff7'); c.beginPath(); c.moveTo(-r * .8, -r * .45); c.lineTo(-r * .2, -r * .3); c.lineTo(0, -r * .1); c.lineTo(r * .2, -r * .3); c.lineTo(r * .8, -r * .45); c.quadraticCurveTo(0, -r * 1.2, -r * .8, -r * .45); FS(c, '#2b2540'); face(c, s, { dy: .02, mouth: 'smile' });[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .1, r * .42); c.lineTo(d * r * .2, r * .42); c.lineTo(d * r * .15, r * .62); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = s * .02; c.stroke(); }); },
  riese(c, s) { glow(c, s, '#8b4fc9'); body(c, s * 1.15, '#a8c58a'); face(c, s * 1.15, { angry: 1, mouth: 'frown', er: .16 }); },
  saege(c, s) {
    const r = s * .36; body(c, s, '#c9ced6');
    [-1, 1].forEach(d => { ci(c, d * r * .38, -r * .1, r * .3, 'rgba(180,230,255,.7)'); });
    ln(c, -r * .08, -r * .1, r * .08, -r * .1, s * .04);
    [-1, 1].forEach(d => cEye(c, d * r * .38, -r * .1, r * .18, 1, s));
    c.lineWidth = s * .035; c.beginPath(); c.moveTo(-r * .3, r * .5); for (let i = 0; i < 6; i++) c.lineTo(-r * .3 + i * r * .12 + r * .06, r * (i % 2 ? .5 : .68)); c.stroke();
  },
  schwarm(c, s) {
    const r = s * .36; [-1, 1].forEach(d => { el(c, d * r * .55, -r * 1.0, r * .32, r * .5, 'rgba(220,240,255,.85)', d * .5); });
    body(c, s, '#ffd84a');
    c.save(); c.beginPath(); c.arc(0, 0, r * .97, 0, 7); c.clip(); c.fillStyle = '#3a3040';
    c.fillRect(-r * 1.1, -r * .42, r * 2.2, r * .2); c.fillRect(-r * 1.1, r * .25, r * 2.2, r * .22); c.restore();
    [-1, 1].forEach(d => { thick(c, s * .025, INK, () => { c.beginPath(); c.moveTo(d * r * .25, -r * .9); c.quadraticCurveTo(d * r * .5, -r * 1.4, d * r * .75, -r * 1.35); }); dot(c, d * r * .75, -r * 1.35, s * .035); });
    face(c, s, { dy: -.02, mouth: 'smile' });
  },
  eis(c, s) {
    const r = s * .36; [[-.5, -.8, -.4], [0, -.95, 0], [.5, -.8, .4]].forEach(p => spike(c, p[0] * r, p[1] * r, p[2], r * .75, r * .2, '#bdeaff'));
    body(c, s, '#cfeaf7'); face(c, s, { mouth: 'o', blush: 0 }); cBlush(c, -r * .62, r * .35, s, .45); cBlush(c, r * .62, r * .35, s, .45);
    stars(c, [[r * .75, r * .75, s * .07]], '#ffffff');
  },
  meteor(c, s) {
    const r = s * .36; flame(c, -r * .55, -r * .55, r * .5, r * 1.2, '#ff8a2a', '#ffd24a'); flame(c, -r * .1, -r * .8, r * .4, r * 1.0, '#ff6a1a', '#ffd24a');
    body(c, s, '#8e7a6a'); [[-.4, .35, .2], [.4, -.2, .16], [.1, .6, .12]].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, '#6e5e50'));
    face(c, s, { angry: 1, mouth: 'grin', dy: -.12 });
  },
  spiegel(c, s) {
    const r = s * .36; body(c, s, '#e3ecf4');
    c.save(); c.beginPath(); c.arc(0, 0, r * .98, 0, 7); c.clip(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = s * .06; ln(c, -r * 1.0, r * .2, r * .2, -r * 1.0); ln(c, -r * .6, r * .8, r * .8, -r * .6, s * .03); c.restore();
    c.lineWidth = s * .08; c.strokeStyle = '#b9a45a'; c.beginPath(); c.arc(0, 0, r * 1.03, 0, 7); c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .06;
    face(c, s, { mouth: 'flat', blush: 0 });
  },
  wuchs(c, s) {
    const r = s * .36; thick(c, s * .04, '#4f9a45', () => { c.beginPath(); c.moveTo(0, -r * .9); c.quadraticCurveTo(0, -r * 1.2, r * .05, -r * 1.35); });
    [-1, 1].forEach(d => { c.beginPath(); c.moveTo(r * .03, -r * 1.3); c.quadraticCurveTo(d * r * .6, -r * 1.7, d * r * .8, -r * 1.2); c.quadraticCurveTo(d * r * .3, -r * 1.05, r * .03, -r * 1.3); FS(c, '#7fd16a'); });
    body(c, s, '#a8dc8c'); face(c, s, {});
  },
  drache(c, s) { const r = s * .36; glow(c, s, '#ffd24a');[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .45, -r * .75); c.lineTo(d * r * .7, -r * 1.45); c.lineTo(d * r * .95, -r * .55); c.closePath(); FS(c, '#fff0c0'); c.beginPath(); c.moveTo(d * r * .9, r * .1); c.quadraticCurveTo(d * r * 1.9, -r * .9, d * r * 1.8, r * .5); c.quadraticCurveTo(d * r * 1.4, r * .2, d * r * 1.1, r * .6); c.closePath(); FS(c, '#c2431f'); }); body(c, s, '#e8603a'); el(c, 0, r * .42, r * .42, r * .28, '#f4a074'); c.fillStyle = INK;[-1, 1].forEach(d => { c.beginPath(); c.arc(d * r * .14, r * .42, r * .05, 0, 7); c.fill(); });[-1, 1].forEach(d => cEye(c, d * r * .38, -r * .15, r * .18, 1, s)); c.lineWidth = s * .05;[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .6, -r * .5); c.lineTo(d * r * .2, -r * .32); c.stroke(); }); },
  phoenix(c, s) { const r = s * .36; glow(c, s, '#ff7a1a');[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .8, 0); c.quadraticCurveTo(d * r * 1.7, -r * 1.1, d * r * 1.9, r * .2); c.quadraticCurveTo(d * r * 1.5, 0, d * r * 1.4, r * .5); c.quadraticCurveTo(d * r * 1.1, r * .1, d * r * .9, r * .5); c.closePath(); FS(c, '#ff8a2a'); });[-1, 0, 1].forEach((d, i) => { c.beginPath(); c.moveTo(d * r * .35 - r * .2, -r * .75); c.quadraticCurveTo(d * r * .6, -r * (1.7 - Math.abs(d) * .3), d * r * .35 + r * .2, -r * .75); c.closePath(); FS(c, i === 1 ? '#ffd24a' : '#ff6a1a'); }); body(c, s, '#ffbe3a'); face(c, s, { angry: 1, mouth: 'flat', er: .17 }); c.beginPath(); c.moveTo(-r * .12, r * .2); c.lineTo(r * .12, r * .2); c.lineTo(0, r * .45); c.closePath(); FS(c, '#ff7a1a'); },
  kaktus(c, s) {
    const r = s * .36; body(c, s, '#6fbf5a');
    c.save(); c.beginPath(); c.arc(0, 0, r * .97, 0, 7); c.clip(); c.lineWidth = s * .03; c.strokeStyle = 'rgba(30,90,40,.55)';
    [-.6, -.2, .2, .6].forEach(k => { c.beginPath(); c.moveTo(k * r, -r); c.quadraticCurveTo(k * r * 1.5, 0, k * r, r); c.stroke(); }); c.restore();
    c.lineWidth = s * .03; [[-.9, -.2], [.9, .1], [-.7, .6], [.75, .6], [0, 1.0], [-.3, -.95], [.5, -.85]].forEach(p => { ln(c, p[0] * r, p[1] * r, p[0] * r * 1.18, p[1] * r * 1.18, s * .035, '#fffbe0'); });
    [-1, 1].forEach(d => { c.beginPath(); c.arc(d * r * .25, -r * 1.0, r * .2, 0, 7); FS(c, '#ff7aa8'); }); dot(c, 0, -r * 1.05, r * .09, '#ffe36a');
    c.lineWidth = s * .06; face(c, s, { mouth: 'flat', dy: -.0 });
  },
  pfeil(c, s) {
    const r = s * .36; body(c, s, '#e0bf8a');
    c.save(); c.rotate(-.5); pl(c, [[-r * .6, -r * 1.0], [r * .5, -r * 1.0], [r * .5, -r * 1.35], [-r * .6, -r * 1.35]], '#d33a3a'); c.restore();
    thick(c, s * .045, '#7a4a21', () => { c.beginPath(); c.moveTo(r * 1.15, -r * .8); c.quadraticCurveTo(r * 1.9, 0, r * 1.15, r * .8); });
    ln(c, r * 1.15, -r * .8, r * 1.15, r * .8, s * .015);
    face(c, s, { dy: .02, angry: 1 });
  },
  rakete(c, s) {
    const r = s * .36; flame(c, 0, r * 1.7, r * .5, r * 1.0, '#ff8a2a', '#ffd24a');
    [-1, 1].forEach(d => pl(c, [[d * r * .75, r * .2], [d * r * 1.35, r * 1.0], [d * r * .7, r * .95]], '#d33a3a'));
    body(c, s, '#f1f3f8', { ry: 1.08 });
    pl(c, [[-r * .72, -r * .62], [0, -r * 1.55], [r * .72, -r * .62], [0, -r * .45]], '#d33a3a');
    face(c, s, { dy: .08, angry: 1, mouth: 'grin' });
  },
  wirbel(c, s) {
    const r = s * .36; body(c, s, '#b7ece3');
    c.save(); c.beginPath(); c.arc(0, 0, r * .98, 0, 7); c.clip(); c.lineWidth = s * .04; c.strokeStyle = 'rgba(40,130,130,.65)';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(r * .1, r * .1, r * (.25 + k * .3), k, k + 3.6); c.stroke(); } c.restore();
    c.lineWidth = s * .06; face(c, s, { mouth: 'o', dy: -.02 });
  },
  magier(c, s) {
    const r = s * .36; body(c, s, '#a98ae0');
    pl(c, [[-r * 1.0, -r * .5], [-r * .5, -r * .75], [-r * .25, -r * 1.9], [r * .3, -r * .8], [r * .55, -r * .6], [r * 1.0, -r * .5], [0, -r * .3]], '#4b3a8c');
    stars(c, [[-r * .05, -r * 1.2, s * .08], [r * .35, -r * .65, s * .05]], '#ffd45a');
    face(c, s, { dy: .08, mouth: 'smile' });
    thick(c, s * .05, '#7a4a21', () => { c.beginPath(); c.moveTo(r * 1.2, r * .6); c.lineTo(r * 1.65, -r * .2); }); stars(c, [[r * 1.7, -r * .3, s * .08]], '#ffe14a');
  },
  /* ===== Weltraum ===== */
  mond(c, s) {
    const r = s * .36; body(c, s, '#f3eac0');
    [[-.4, -.5, .2], [.5, .35, .26], [-.1, .7, .13], [.6, -.45, .1]].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, '#ddd3a2'));
    face(c, s, { bl: .55, dy: -.1, mouth: 'smile' });
  },
  komet(c, s) {
    const r = s * .36; flame(c, -r * .3, -r * .35, r * .55, r * 1.9, '#9ad8ff', '#ffffff'); c.save(); c.rotate(-.7); flame(c, -r * .9, -r * .2, r * .5, r * 1.8, '#7fc7f5', '#ffffff'); c.restore();
    body(c, s, '#cfe4f5'); [[-.4, .3, .17], [.4, -.1, .14]].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, '#a8c2d8'));
    face(c, s, { angry: 1, mouth: 'grin', dy: -.1 });
  },
  astronaut(c, s) {
    const r = s * .36; body(c, s, '#f4f5f8');
    el(c, 0, -r * .05, r * .82, r * .62, '#2a3a60');
    c.save(); c.beginPath(); c.ellipse(0, -r * .05, r * .8, r * .6, 0, 0, 7); c.clip(); c.fillStyle = 'rgba(120,180,255,.35)'; c.beginPath(); c.ellipse(-r * .2, -r * .3, r * .5, r * .2, -.4, 0, 7); c.fill(); c.restore();
    [-1, 1].forEach(d => cEye(c, d * r * .3, -r * .05, r * .17, 1, s)); thick(c, s * .025, INK, () => { c.beginPath(); c.moveTo(r * .55, -r * .85); c.lineTo(r * .75, -r * 1.3); }); dot(c, r * .75, -r * 1.3, s * .04, '#e0453a');
    c.lineWidth = s * .035; c.beginPath(); c.arc(0, r * .55, r * .18, .2, PI - .2); c.stroke();
  },
  ufo(c, s) {
    const r = s * .36; el(c, 0, -r * .35, r * .65, r * .6, 'rgba(160,240,200,.9)');
    cEye(c, -r * .22, -r * .38, r * .17, 1, s); cEye(c, r * .22, -r * .38, r * .17, 1, s);
    body(c, s * .92, '#aab3c2', { ry: .55 }); el(c, 0, r * .05, r * 1.55, r * .38, '#c9d0dc');
    [-1, -.5, 0, .5, 1].forEach(k => dot(c, k * r * 1.1, r * .1 + Math.abs(k) * 2, s * .035, k % 1 ? '#ffd45a' : '#ff6a8a'));
  },
  saturn(c, s) { const r = s * .36; c.beginPath(); c.ellipse(0, 0, r * 1.7, r * .45, -.3, PI, 0); c.lineWidth = s * .07; c.strokeStyle = INK; c.stroke(); body(c, s, '#e9c27a'); c.beginPath(); c.ellipse(0, 0, r * 1.7, r * .45, -.3, 0, PI); c.lineWidth = s * .07; c.stroke(); c.strokeStyle = '#f3e3b0'; c.lineWidth = s * .03; c.beginPath(); c.ellipse(0, 0, r * 1.7, r * .45, -.3, 0, PI); c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .06; face(c, s, { dy: -.15 }); },
  alien(c, s) {
    const r = s * .36;[-1, 1].forEach(d => { thick(c, s * .03, '#4f9a45', () => { c.beginPath(); c.moveTo(d * r * .35, -r * .85); c.quadraticCurveTo(d * r * .6, -r * 1.3, d * r * .85, -r * 1.35); }); ci(c, d * r * .85, -r * 1.38, s * .055, '#c6ff8a'); });
    body(c, s, '#8fdc6e', { ry: 1.05 });
    [-1, 1].forEach(d => { el(c, d * r * .42, -r * .05, r * .3, r * .42, '#1a2230', d * .5); dot(c, d * r * .35, -r * .15, r * .08, '#fff'); });
    c.lineWidth = s * .035; c.beginPath(); c.arc(0, r * .42, r * .16, .3, PI - .3); c.stroke();
  },
  schwarzloch(c, s) {
    const r = s * .36; glow(c, s, '#8b4fc9', .95);
    c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .5, .25, PI, 0); c.lineWidth = s * .07; c.strokeStyle = INK; c.stroke();
    body(c, s, '#2b2338'); c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .5, .25, 0, PI); c.lineWidth = s * .08; c.stroke(); c.strokeStyle = '#ff9a3a'; c.lineWidth = s * .04; c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .5, .25, 0, PI); c.stroke(); c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .5, .25, PI, 0); c.stroke();
    c.strokeStyle = INK; c.lineWidth = s * .06; face(c, s, { dy: -.15, mouth: 'o', blush: 0 });
  },
  supernova(c, s) {
    const r = s * .36; glow(c, s * 1.2, '#ffe14a');
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; spike(c, Math.cos(a) * r * .9, Math.sin(a) * r * .9, a + 1.5708, s * (i % 2 ? .16 : .26), s * .07, i % 2 ? '#ffb62e' : '#fff2a0'); }
    body(c, s, '#fff0a0'); face(c, s, { angry: 1, mouth: 'grin' });
  },
  /* ===== Küche ===== */
  pizza(c, s) { body(c, s, '#f6c75a'); c.fillStyle = '#d6402f';[[-.2, -.25], [.22, -.3], [.3, .15], [-.3, .2], [0, .38]].forEach(p => { c.beginPath(); c.arc(p[0] * s * .75, p[1] * s * .75, s * .055, 0, 7); c.fill(); c.lineWidth = s * .02; c.stroke(); }); face(c, s, { dy: -.02, mouth: 'grin' }); },
  ei(c, s) {
    const r = s * .36; body(c, s, '#fff7e4', { ry: 1.1, rx: .95 });
    c.lineWidth = s * .035; c.beginPath(); c.moveTo(-r * .55, -r * .75); c.lineTo(-r * .3, -r * .55); c.lineTo(-r * .1, -r * .8); c.lineTo(r * .15, -r * .55); c.lineTo(r * .35, -r * .85); c.lineTo(r * .6, -r * .6); c.stroke();
    face(c, s, { sad: 1, mouth: 'o', dy: 0 });
  },
  toast(c, s) {
    const r = s * .36; body(c, s, '#f0c47c', { rx: 1.02, ry: .98 });
    c.lineWidth = s * .05; c.strokeStyle = '#b9803a'; c.beginPath(); c.ellipse(0, 0, r * .82, r * .8, 0, 0, 7); c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .06;
    pl(c, [[r * .35, -r * .95], [r * .8, -r * .9], [r * .85, -r * .6], [r * .4, -r * .65]], '#ffe98a');
    face(c, s, { dy: 0 });
  },
  messer(c, s) {
    const r = s * .36; body(c, s, '#d6dae0');
    c.save(); c.translate(r * 1.0, -r * .1); c.rotate(.35);
    pl(c, [[0, -r * .12], [r * 1.5, -r * .12], [r * 1.75, r * .25], [0, r * .25]], '#f1f4f8'); pl(c, [[-r * .7, -r * .15], [0, -r * .15], [0, r * .28], [-r * .7, r * .28]], '#7a4a21'); c.restore();
    face(c, s, { angry: 1, mouth: 'flat', blush: 0 });
  },
  pfanne(c, s) {
    const r = s * .36; c.save(); c.rotate(.5); pl(c, [[r * .9, -r * .2], [r * 2.0, -r * .15], [r * 2.0, r * .15], [r * .9, r * .2]], '#7a4a21'); c.restore();
    body(c, s, '#585d68'); el(c, 0, r * .08, r * .72, r * .6, '#fff7e4'); ci(c, r * .0, r * .45, r * .22, '#ffc83a');
    [-1, 1].forEach(d => cEye(c, d * r * .3, -r * .22, r * .17, 1, s));
  },
  chili(c, s) {
    const r = s * .36; thick(c, s * .06, '#3f9a45', () => { c.beginPath(); c.moveTo(-r * .1, -r * .9); c.quadraticCurveTo(-r * .2, -r * 1.35, r * .3, -r * 1.5); });
    body(c, s, '#e0392b', { ry: 1.05 }); face(c, s, { angry: 1, mouth: 'grin' });
    c.fillStyle = '#6cc4ee'; c.beginPath(); c.moveTo(r * .95, -r * .4); c.quadraticCurveTo(r * 1.15, -r * .1, r * .95, r * .02); c.quadraticCurveTo(r * .75, -r * .1, r * .95, -r * .4); c.fill(); c.lineWidth = s * .025; c.stroke();
  },
  mixer(c, s) {
    const r = s * .36; [-1, 1].forEach(d => { c.beginPath(); c.ellipse(d * r * .45, r * 1.2, r * .28, r * .5, 0, 0, 7); c.lineWidth = s * .035; c.stroke(); });
    body(c, s, '#f1f3f8'); ci(c, 0, -r * .95, r * .22, '#d33a3a'); face(c, s, { dy: 0 });
  },
  herd(c, s) {
    const r = s * .36; glow(c, s, '#ff7a1a');
    body(c, s, '#4a4d57'); el(c, 0, r * .62, r * .5, r * .2, '#ff7a1a'); el(c, 0, r * .62, r * .3, r * .12, '#ffd24a');
    [[-.55, -.1], [.55, -.1]].forEach(p => ci(c, p[0] * r, p[1] * r, r * .22, '#ff9a3a'));
    [-1, 1].forEach(d => cEye(c, d * r * .3, -r * .3, r * .17, 1, s)); c.lineWidth = s * .05; [-1, 1].forEach(d => ln(c, d * r * .55, -r * .6, d * r * .15, -r * .5));
    const hat = [[-r * .6, -r * .8], [-r * .75, -r * 1.3], [-r * .35, -r * 1.65], [0, -r * 1.55], [r * .4, -r * 1.7], [r * .78, -r * 1.3], [r * .6, -r * .8]];
    pl(c, hat, '#ffffff');
  },
  /* ===== Sport und Spielzeug ===== */
  basket(c, s) { const r = s * .36; body(c, s, '#e98a3a'); c.lineWidth = s * .035; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke(); c.beginPath(); c.arc(-r * 1.2, 0, r * .75, -.9, .9); c.stroke(); c.beginPath(); c.arc(r * 1.2, 0, r * .75, PI - .9, PI + .9); c.stroke(); c.lineWidth = s * .06; face(c, s, { dy: -.25, sp: .3, er: .17 }); },
  tennis(c, s) {
    const r = s * .36; body(c, s, '#d4ec4a');
    c.lineWidth = s * .035; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(-r * 1.3, 0, r * .9, -.7, .7); c.stroke(); c.beginPath(); c.arc(r * 1.3, 0, r * .9, PI - .7, PI + .7); c.stroke(); c.strokeStyle = INK;
    pl(c, [[-r * 1.0, -r * .5], [r * 1.0, -r * .5], [r * .95, -r * .75], [-r * .95, -r * .75]], '#ffffff');
    c.lineWidth = s * .06; face(c, s, { dy: .02 });
  },
  bowling(c, s) {
    const r = s * .36; body(c, s, '#2f3a66');
    [[-.2, -.75], [.2, -.78]].forEach(p => dot(c, p[0] * r, p[1] * r, r * .1, '#10152e')); dot(c, 0, -r * .5, r * .1, '#10152e');
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-r * .5, -r * .5, r * .18, r * .1, -.7, 0, 7); c.fill();
    face(c, s, { angry: 1, mouth: 'flat', blush: 0, dy: 0 });
  },
  jojo(c, s) {
    const r = s * .36; thick(c, s * .025, '#f1ede0', () => { c.beginPath(); c.moveTo(0, -r * .95); c.quadraticCurveTo(r * .6, -r * 1.5, r * 1.1, -r * 1.2); }); c.beginPath(); c.arc(r * 1.15, -r * 1.2, r * .22, 0, 7); c.lineWidth = s * .035; c.stroke();
    body(c, s, '#e0453a');
    c.lineWidth = s * .05; c.strokeStyle = '#fff2c0'; c.beginPath(); c.arc(0, 0, r * .88, 0, 7); c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .06;
    face(c, s, { mouth: 'grin' });
  },
  kreisel(c, s) {
    const r = s * .36; pl(c, [[-r * .45, r * .75], [0, r * 1.5], [r * .45, r * .75]], '#8a8f99');
    thick(c, s * .06, '#7a4a21', () => { c.beginPath(); c.moveTo(0, -r * .95); c.lineTo(0, -r * 1.45); });
    body(c, s, '#ffd84a', { rx: 1.1, ry: .95 });
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 1.08, r * .93, 0, 0, 7); c.clip(); c.fillStyle = '#e0453a'; c.fillRect(-r * 1.2, -r * .5, r * 2.4, r * .22); c.fillStyle = '#3b7fd4'; c.fillRect(-r * 1.2, r * .38, r * 2.4, r * .22); c.restore();
    face(c, s, { dy: -.05, mouth: 'grin', er: .18 });
  },
  teddy(c, s) {
    const r = s * .36;[-1, 1].forEach(d => { ci(c, d * r * .75, -r * .8, r * .38, '#a8764a'); ci(c, d * r * .75, -r * .8, r * .2, '#e8b88a'); });
    body(c, s, '#b9854f'); el(c, 0, r * .3, r * .46, r * .36, '#ecc9a0'); el(c, 0, r * .18, r * .13, r * .09, '#3a2a22');
    [-1, 1].forEach(d => cEye(c, d * r * .38, -r * .22, r * .16, 1, s)); c.lineWidth = s * .03; c.beginPath(); c.moveTo(0, r * .27); c.lineTo(0, r * .42); c.moveTo(-r * .18, r * .5); c.quadraticCurveTo(0, r * .6, r * .18, r * .5); c.stroke();
    pl(c, [[-r * .45, r * .98], [0, r * .88], [r * .45, r * .98], [r * .45, r * 1.25], [0, r * 1.12], [-r * .45, r * 1.25]], '#d33a3a');
  },
  lego(c, s) {
    const r = s * .36; [-1, 1].forEach(d => { pl(c, [[d * r * .6 - r * .3, -r * .75], [d * r * .6 + r * .3, -r * .75], [d * r * .6 + r * .3, -r * 1.15], [d * r * .6 - r * .3, -r * 1.15]], '#e0453a'); el(c, d * r * .6, -r * 1.15, r * .3, r * .12, '#f06a5a'); });
    body(c, s, '#e0453a', { rx: 1.1, ry: .95 }); face(c, s, { dy: 0 });
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 1.08, r * .93, 0, 0, 7); c.clip(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-r * 1.2, -r * .9, r * 2.4, r * .18); c.restore();
  },
  pokal(c, s) {
    const r = s * .36; glow(c, s, '#ffd24a');
    [-1, 1].forEach(d => { thick(c, s * .05, '#e0a800', () => { c.beginPath(); c.moveTo(d * r * .85, -r * .5); c.quadraticCurveTo(d * r * 1.7, -r * .5, d * r * 1.25, r * .25); }); });
    pl(c, [[-r * .45, r * .85], [r * .45, r * .85], [r * .6, r * 1.2], [-r * .6, r * 1.2]], '#b9871a'); pl(c, [[-r * .12, r * .8], [r * .12, r * .8], [r * .12, r * .9], [-r * .12, r * .9]], '#e0a800');
    body(c, s, '#ffd94a'); stars(c, [[0, r * .52, s * .07]], '#ffffff');
    face(c, s, { dy: -.2, mouth: 'grin', er: .18 });
  },
  /* ===== Elemente und Wetter ===== */
  wolke(c, s) {
    const r = s * .36; [[-.7, .2, .55], [.7, .2, .55], [-.3, -.4, .6], [.35, -.35, .6], [0, .35, .65]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, p[2] * r, 0, 7); c.fillStyle = '#eef3fa'; c.fill(); c.stroke(); });
    [[-.7, .2, .55], [.7, .2, .55], [-.3, -.4, .6], [.35, -.35, .6], [0, .35, .65]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, p[2] * r - 1.5, 0, 7); c.fillStyle = '#eef3fa'; c.fill(); });
    face(c, s, { dy: -.05, mouth: 'smile' });
    [-.6, 0, .6].forEach((x, i) => { c.beginPath(); c.moveTo(x * r, r * 1.05 + i % 2 * r * .1); c.quadraticCurveTo(x * r + r * .12, r * 1.3, x * r, r * 1.45); c.quadraticCurveTo(x * r - r * .12, r * 1.3, x * r, r * 1.05); FS(c, '#6cc4ee'); });
  },
  schnee(c, s) {
    const r = s * .36; body(c, s, '#f4f8ff');
    pl(c, [[0, r * .05], [r * 1.15, r * .15], [0, r * .3]], '#f58a1f');
    [-1, 1].forEach(d => { cEye(c, d * r * .36, -r * .3, r * .15, 1, s); }); dot(c, -r * .2, r * .62, s * .025); dot(c, 0, r * .68, s * .025); dot(c, r * .2, r * .62, s * .025);
    pl(c, [[-r * .8, r * .75], [r * .8, r * .75], [r * .75, r * .98], [-r * .75, r * .98]], '#d33a3a');
  },
  blitz(c, s) { const r = s * .36; glow(c, s, '#ffe84a'); body(c, s, '#ffe14a'); c.beginPath(); c.moveTo(r * .1, -r * 1.35); c.lineTo(-r * .35, -r * .65); c.lineTo(-r * .05, -r * .65); c.lineTo(-r * .3, -r * .1); c.lineTo(r * .25, -r * .8); c.lineTo(r * .0, -r * .8); c.closePath(); FS(c, '#fff6a0'); face(c, s, { dy: .1, mouth: 'grin', er: .18 }); },
  tornado(c, s) {
    const r = s * .36; [[1.2, '#bfc8d6', 0], [.9, '#aab4c4', .5], [.6, '#96a2b6', 1]].forEach(p => { el(c, 0, r * (.9 + p[2] * .45), r * p[0], r * .2, p[1]); });
    body(c, s, '#c9d3e2'); c.lineWidth = s * .035; c.strokeStyle = 'rgba(70,90,130,.6)';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, r * (.3 + k * .28), k * 2, k * 2 + 3.2); c.stroke(); } c.strokeStyle = INK; c.lineWidth = s * .06;
    face(c, s, { angry: 1, mouth: 'o', dy: -.05, blush: 0 });
  },
  erde(c, s) {
    const r = s * .36; body(c, s, '#a58862', { rx: 1.05, ry: .98 });
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 1.03, r * .96, 0, 0, 7); c.clip(); c.lineWidth = s * .03;
    c.beginPath(); c.moveTo(-r * .9, -r * .1); c.lineTo(-r * .5, r * .1); c.lineTo(-r * .6, r * .5); c.moveTo(r * .5, r * .5); c.lineTo(r * .8, r * .2); c.lineTo(r * .6, -r * .1); c.stroke(); c.restore();
    [-1, 0, 1].forEach(k => { c.beginPath(); c.moveTo(k * r * .38 - r * .15, -r * .88); c.quadraticCurveTo(k * r * .38, -r * 1.35, k * r * .38 + r * .15, -r * .88); FS(c, '#6fbf5a'); });
    face(c, s, { angry: 1, mouth: 'flat', blush: 0, dy: -.05 });
  },
  lava(c, s) {
    const r = s * .36; glow(c, s, '#ff5a1a'); body(c, s, '#6a2a24');
    c.save(); c.beginPath(); c.arc(0, 0, r * .98, 0, 7); c.clip(); c.lineWidth = s * .04; c.strokeStyle = '#ff9a3a';
    c.beginPath(); c.moveTo(-r * .9, r * .2); c.lineTo(-r * .4, r * .45); c.lineTo(-r * .1, r * .15); c.lineTo(r * .4, r * .5); c.lineTo(r * .9, r * .3); c.stroke();
    c.beginPath(); c.moveTo(-r * .3, -r * .9); c.lineTo(-r * .1, -r * .55); c.lineTo(r * .2, -r * .7); c.stroke(); c.restore();
    c.strokeStyle = INK; [-1, 1].forEach(d => { c.beginPath(); c.arc(d * r * .36, -r * .18, r * .2, 0, 7); c.fillStyle = '#ffe36a'; c.fill(); c.lineWidth = s * .03; c.stroke(); dot(c, d * r * .36, -r * .18, r * .08); });
    c.lineWidth = s * .05; ln(c, -r * .6, -r * .5, -r * .2, -r * .4); ln(c, r * .6, -r * .5, r * .2, -r * .4);
    c.beginPath(); c.moveTo(r * .55, r * .95); c.quadraticCurveTo(r * .7, r * 1.2, r * .55, r * 1.3); c.quadraticCurveTo(r * .4, r * 1.2, r * .55, r * .95); FS(c, '#ff7a1a');
  },
  kristall(c, s) {
    const r = s * .36; [[-.5, -.9, -.45, .85], [0, -1.0, 0, 1.1], [.5, -.9, .45, .85]].forEach(p => spike(c, p[0] * r, p[1] * r, p[2], r * p[3], r * .25, '#e6b8ff'));
    body(c, s, '#c68bf0');
    c.save(); c.beginPath(); c.arc(0, 0, r * .98, 0, 7); c.clip(); c.lineWidth = s * .025; c.strokeStyle = 'rgba(255,255,255,.7)';
    c.beginPath(); c.moveTo(-r, -r * .2); c.lineTo(0, r * .4); c.lineTo(r, -r * .2); c.moveTo(0, -r); c.lineTo(0, r * .4); c.moveTo(-r * .5, r * .8); c.lineTo(0, r * .4); c.lineTo(r * .5, r * .8); c.stroke(); c.restore();
    c.strokeStyle = INK; face(c, s, { dy: -.05, mouth: 'smile' });
  },
  regenbogen(c, s) {
    const r = s * .36; glow(c, s, '#ffffff');
    ['#e0453a', '#f58a1f', '#ffd24a', '#5cc45a', '#3b7fd4'].forEach((col, i) => { c.beginPath(); c.arc(0, -r * .1, r * (1.9 - i * .17), PI, 0); c.lineWidth = s * .08; c.strokeStyle = col; c.stroke(); });
    c.strokeStyle = INK; c.lineWidth = s * .06; body(c, s, '#ffffff'); face(c, s, { mouth: 'grin' });
    stars(c, [[-r * 1.2, -r * 1.1, s * .06], [r * 1.25, -r * 1.0, s * .05]], '#ffd45a');
  },
  /* ===== Halloween ===== */
  kuerbis(c, s) { const r = s * .36; glow(c, s, '#ff8a1a'); c.beginPath(); c.moveTo(0, -r * .9); c.quadraticCurveTo(r * .08, -r * 1.3, r * .3, -r * 1.35); c.lineWidth = s * .08; c.stroke(); c.lineWidth = s * .06; body(c, s, '#f58a1f', { rx: 1.15, ry: .95 }); c.lineWidth = s * .025; c.strokeStyle = 'rgba(120,50,0,.4)';[-.5, 0, .5].forEach(k => { c.beginPath(); c.moveTo(k * r * .7, -r * .85); c.quadraticCurveTo(k * r * 1.15, 0, k * r * .7, r * .85); c.stroke(); }); c.strokeStyle = INK; c.fillStyle = '#ffe36a';[-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .5, -r * .5); c.lineTo(d * r * .15, -r * .1); c.lineTo(d * r * .65, -r * .05); c.closePath(); FS(c, '#ffe36a'); }); c.beginPath(); c.moveTo(-r * .6, r * .2); for (let i = 0; i < 7; i++) c.lineTo(-r * .6 + i * r * .2, r * (i % 2 ? .2 : .5)); c.lineTo(r * .6, r * .2); c.closePath(); FS(c, '#ffe36a'); },
  fledermaus(c, s) {
    const r = s * .36;[-1, 1].forEach(d => {
      c.beginPath(); c.moveTo(d * r * .7, -r * .2); c.quadraticCurveTo(d * r * 1.5, -r * 1.4, d * r * 2.0, -r * .6); c.quadraticCurveTo(d * r * 1.8, -r * .3, d * r * 1.7, 0); c.quadraticCurveTo(d * r * 1.5, -r * .15, d * r * 1.3, r * .15); c.quadraticCurveTo(d * r * 1.1, 0, d * r * .9, r * .25); c.closePath(); FS(c, '#4a3566');
      pl(c, [[d * r * .3, -r * .85], [d * r * .5, -r * 1.45], [d * r * .75, -r * .8]], '#4a3566');
    });
    body(c, s, '#6a4c8c', { rx: .95 }); [-1, 1].forEach(d => cEye(c, d * r * .33, -r * .12, r * .2, 1, s)); face(c, s, { noeyes: 1, mouth: 'fang', blush: 0 });
  },
  geist(c, s) { const r = s * .36; glow(c, s, '#b9a2ff'); c.globalAlpha = .88; c.beginPath(); c.moveTo(-r, -r * .1); c.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, -r * .1); c.lineTo(r, r * .85); for (let i = 0; i < 4; i++) c.quadraticCurveTo(r - (i + .5) * r * .5, r * 1.15 - (i % 2) * r * .2, r - (i + 1) * r * .5, r * .85); c.closePath(); FS(c, '#f1f4ff'); c.globalAlpha = 1;[-1, 1].forEach(d => { c.beginPath(); c.ellipse(d * r * .35, -r * .15, r * .13, r * .2, 0, 0, 7); c.fillStyle = INK; c.fill(); }); c.beginPath(); c.ellipse(0, r * .25, r * .12, r * .17, 0, 0, 7); c.fillStyle = INK; c.fill(); cBlush(c, -r * .62, r * .15, s, .3); cBlush(c, r * .62, r * .15, s, .3); },
  skelett(c, s) {
    const r = s * .36; body(c, s, '#f1ecdc');
    [-1, 1].forEach(d => el(c, d * r * .38, -r * .1, r * .28, r * .34, '#1d2742'));
    [-1, 1].forEach(d => dot(c, d * r * .38 + r * .05, -r * .16, r * .06, '#fff'));
    pl(c, [[0, r * .2], [-r * .1, r * .42], [r * .1, r * .42]], '#1d2742');
    c.lineWidth = s * .03; c.beginPath(); c.moveTo(-r * .45, r * .62); c.lineTo(r * .45, r * .62); c.stroke(); for (let k = -2; k <= 2; k++) ln(c, k * r * .18, r * .52, k * r * .18, r * .72, s * .025);
  },
  hexe(c, s) {
    const r = s * .36; body(c, s, '#9bd37a');
    pl(c, [[-r * 1.25, -r * .55], [r * 1.25, -r * .55], [r * .8, -r * .8], [-r * .8, -r * .8]], '#4b2f7a');
    pl(c, [[-r * .6, -r * .75], [r * .5, -r * .75], [r * .1, -r * 2.0]], '#5a3a90'); pl(c, [[-r * .58, -r * .78], [r * .5, -r * .78], [r * .45, -r * 1.05], [-r * .5, -r * 1.05]], '#d33a3a');
    face(c, s, { dy: .08, mouth: 'grin' }); pl(c, [[-r * .05, r * .02], [r * .12, r * .3], [-r * .12, r * .3]], '#7bbf5a'); dot(c, r * .35, r * .52, s * .02);
  },
  sensenmann(c, s) {
    const r = s * .36; glow(c, s, '#7aff9a', .85);
    c.save(); c.rotate(-.9); thick(c, s * .05, '#7a4a21', () => { c.beginPath(); c.moveTo(-r * 1.6, 0); c.lineTo(r * 1.9, 0); }); c.beginPath(); c.moveTo(r * 1.7, -r * .1); c.quadraticCurveTo(r * 2.3, -r * 1.2, r * 1.0, -r * 1.35); c.quadraticCurveTo(r * 1.7, -r * .8, r * 1.5, r * .0); c.closePath(); FS(c, '#cfd6e2'); c.restore();
    body(c, s, '#2a2540'); el(c, 0, -r * .05, r * .62, r * .7, '#f4f1e4');
    [-1, 1].forEach(d => el(c, d * r * .26, -r * .15, r * .17, r * .2, INK)); pl(c, [[0, r * .08], [-r * .06, r * .22], [r * .06, r * .22]], INK);
    c.lineWidth = s * .03; ln(c, -r * .26, r * .4, r * .26, r * .4); for (let k = -2; k <= 2; k++) ln(c, k * r * .11, r * .33, k * r * .11, r * .47, s * .022);
    stars(c, [[-r * .95, -r * .95, s * .05]], '#7aff9a');
  },
  /* ===== Ozean ===== */
  krabbe(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => [0, 1, 2].forEach(i => ln(c, d * r * .7, (i - 1) * r * .38 + r * .25, d * r * 1.3, (i - 1) * r * .55 + r * .6, s * .045, '#b8402a')));
    [-1, 1].forEach(d => { ln(c, d * r * .85, -r * .15, d * r * 1.25, -r * .75, s * .06, '#e0533a'); pl(c, [[d * r * 1.0, -r * .72], [d * r * 1.45, -r * 1.35], [d * r * 1.7, -r * .8], [d * r * 1.35, -r * .5]], '#e0533a'); ln(c, d * r * 1.38, -r * 1.2, d * r * 1.38, -r * .7, s * .02, INK); });
    body(c, s, '#e8603f', { rx: 1.12, ry: .9 });
    [-1, 1].forEach(d => { ln(c, d * r * .3, -r * .75, d * r * .3, -r * 1.05, s * .03); cEye(c, d * r * .3, -r * 1.12, r * .17, 1, s); });
    face(c, s, { noeyes: 1, mouth: 'grin', dy: .1, blush: 0 });
  },
  qualle(c, s) {
    const r = s * .36; glow(c, s, '#e29bff', .9);
    [-.65, -.22, .22, .65].forEach((k, i) => thick(c, s * .045, '#d788ff', () => { c.beginPath(); c.moveTo(k * r, r * .1); c.quadraticCurveTo(k * r + r * (i % 2 ? .35 : -.35), r * .6, k * r, r * 1.05); }));
    c.beginPath(); c.moveTo(-r * 1.05, r * .15); c.bezierCurveTo(-r * 1.1, -r * 1.55, r * 1.1, -r * 1.55, r * 1.05, r * .15); c.quadraticCurveTo(r * .5, r * .3, 0, r * .12); c.quadraticCurveTo(-r * .5, r * .3, -r * 1.05, r * .15); c.closePath(); FS(c, '#efb4ff');
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * .45, -r * .85, r * .22, r * .1, -.6, 0, 7); c.fill();
    [-1, 1].forEach(d => cEye(c, d * r * .38, -r * .35, r * .17, 1, s)); face(c, s, { noeyes: 1, mouth: 'o', dy: -.2, my: -.1 });
  },
  kugelfisch(c, s) {
    const r = s * .36;
    pl(c, [[-r * .95, 0], [-r * 1.55, -r * .55], [-r * 1.45, r * .55]], '#e0b832');
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; spike(c, Math.cos(a) * r * .96, Math.sin(a) * r * .96, a + 1.5708, s * .13, s * .05, '#c9a82a'); }
    body(c, s, '#f2d74c', { rx: 1.04 }); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(0, r * .45, r * .6, r * .3, 0, 0, 7); c.fill();
    face(c, s, { mouth: 'o', er: .22 });
  },
  seestern(c, s) {
    const r = s * .36; glow(c, s, '#ffb27a', .8);
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, q = i % 2 ? r * .62 : r * 1.38; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); FS(c, '#ff9a5a');
    c.fillStyle = '#ffd0a8'; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * 1.2566; c.beginPath(); c.arc(Math.cos(a) * r * .95, Math.sin(a) * r * .95, s * .018, 0, 7); c.fill(); }
    face(c, s, { dy: -.02, mouth: 'smile', er: .17 });
  },
  hai(c, s) {
    const r = s * .36; glow(c, s, '#8fc4e8', .8);
    pl(c, [[-r * .3, -r * .8], [r * .05, -r * 1.7], [r * .55, -r * .75]], '#6f8ba3');
    pl(c, [[-r * .95, r * .1], [-r * 1.6, -r * .5], [-r * 1.5, r * .6]], '#6f8ba3');
    body(c, s, '#7f9bb3', { rx: 1.12 }); el(c, 0, r * .45, r * .85, r * .38, '#e8f0f6');
    c.lineWidth = s * .05; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * (r * .36 + r * .24), -r * .45); c.lineTo(d * (r * .36 - r * .2), -r * .26); c.stroke(); });
    [-1, 1].forEach(d => cEye(c, d * r * .36, -r * .12, r * .16, .8, s)); c.lineWidth = s * .03; c.beginPath(); c.moveTo(-r * .55, r * .38); for (let i = 0; i <= 5; i++) c.lineTo(-r * .55 + i * r * .22, r * .38 + (i % 2 ? r * .02 : r * .2)); c.stroke();
    [-2, -1, 0, 1, 2].forEach(k => pl(c, [[k * r * .2 - r * .07, r * .4], [k * r * .2, r * .56], [k * r * .2 + r * .07, r * .4]], '#fff'));
  },
  krake(c, s) {
    const r = s * .36; glow(c, s, '#c58aff', .95);
    [-1, -.6, -.2, .2, .6, 1].forEach((k, i) => thick(c, s * .06, '#9a4fc7', () => { c.beginPath(); c.moveTo(k * r * .7, r * .5); c.bezierCurveTo(k * r * 1.3, r * .9, k * r * .4 + (i % 2 ? r * .5 : -r * .5), r * 1.3, k * r * 1.2, r * 1.5); }));
    body(c, s, '#b25fe0', { rx: .98, ry: 1.1 });
    c.fillStyle = '#e9c4ff'; [[-.5, -.55], [.45, -.62], [.05, -.8]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, s * .028, 0, 7); c.fill(); });
    face(c, s, { angry: 1, mouth: 'grin', er: .22 }); stars(c, [[r * 1.05, -r * 1.0, s * .05]], '#ffe14a');
  },
  /* ===== Süßigkeiten ===== */
  lolli(c, s) {
    const r = s * .36; ln(c, 0, r * .7, 0, r * 1.55, s * .07, '#f4efe6');
    body(c, s, '#ff7ab8');
    c.lineWidth = s * .05; c.strokeStyle = '#ffe3f1'; c.beginPath(); for (let i = 0; i < 40; i++) { const a = i * .3, q = r * (.12 + i * .02); c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.stroke(); c.strokeStyle = INK;
    c.lineWidth = s * .035; [-1, 1].forEach(d => cEye(c, d * r * .34, -r * .12, r * .17, 1, s)); c.beginPath(); c.arc(0, r * .34, r * .18, .15, PI - .15); c.stroke();
  },
  gummi(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => { ci(c, d * r * .78, -r * .85, r * .38, '#ff5a6a'); ci(c, d * r * .78, -r * .85, r * .18, '#ffa0aa'); });
    [-1, 1].forEach(d => ci(c, d * r * .95, r * .8, r * .34, '#ff5a6a'));
    body(c, s, '#ff5a6a', { rx: 1.0, ry: .98 }); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(0, r * .38, r * .55, r * .36, 0, 0, 7); c.fill();
    face(c, s, { mouth: 'smile' }); ci(c, 0, r * .18, r * .1, '#7a2a35');
  },
  donut(c, s) {
    const r = s * .36; glow(c, s, '#ffb8d8', .8);
    body(c, s, '#e0a257', { rx: 1.1, ry: 1.0 });
    c.beginPath(); c.moveTo(-r * 1.05, -r * .05); c.quadraticCurveTo(-r * 1.1, -r * 1.05, 0, -r * 1.0); c.quadraticCurveTo(r * 1.1, -r * 1.05, r * 1.05, -r * .05); for (let i = 0; i < 5; i++) c.quadraticCurveTo(r * (.9 - i * .4), r * (.35 + (i % 2) * .22), r * (.65 - i * .4), r * .0); c.closePath(); FS(c, '#ff8ac0');
    [['#ffe14a', -.6, -.55, .5], ['#6fe0ff', .2, -.75, -.4], ['#fff', .65, -.4, 1.1], ['#8aff9a', -.15, -.3, .2], ['#ffe14a', .45, -.15, -.9]].forEach(p => ln(c, p[1] * r - r * .08 * Math.cos(p[3]), p[2] * r - r * .08 * Math.sin(p[3]), p[1] * r + r * .08 * Math.cos(p[3]), p[2] * r + r * .08 * Math.sin(p[3]), s * .035, p[0]));
    face(c, s, { dy: .18, mouth: 'smile', er: .17 });
  },
  zuckerwatte(c, s) {
    const r = s * .36; glow(c, s, '#ffc2e6', .9);
    ln(c, 0, r * .8, 0, r * 1.6, s * .07, '#d8b88a');
    [[-.75, .1, .55, '#bfe4ff'], [.75, .1, .55, '#bfe4ff'], [-.45, -.6, .6, '#ffc2e6'], [.45, -.6, .6, '#ffc2e6'], [0, .35, .7, '#ffc2e6'], [0, -.1, .85, '#ffd6ef']].forEach(p => ci(c, p[0] * r, p[1] * r, p[2] * r, p[3]));
    face(c, s, { mouth: 'smile', dy: -.05 });
  },
  torte(c, s) {
    const r = s * .36; glow(c, s, '#ffe0a0', .8);
    c.beginPath(); c.rect(-r * 1.05, r * .1, r * 2.1, r * .9); FS(c, '#c98a5a');
    c.beginPath(); c.rect(-r * .72, -r * .55, r * 1.44, r * .65); FS(c, '#fff1d6');
    c.beginPath(); c.moveTo(-r * .72, -r * .55); for (let i = 0; i < 5; i++) c.quadraticCurveTo(-r * .72 + (i + .5) * r * .288, -r * .1 - (i % 2) * r * .22, -r * .72 + (i + 1) * r * .288, -r * .55); c.closePath(); FS(c, '#ff8ac0');
    ci(c, 0, -r * .7, r * .16, '#e0453a'); ln(c, r * .5, -r * .55, r * .5, -r * .98, s * .04, '#6fe0ff'); pl(c, [[r * .5, -r * 1.0], [r * .42, -r * 1.2], [r * .58, -r * 1.2]], '#ffd24a');
    [-1, 1].forEach(d => cEye(c, d * r * .38, r * .4, r * .17, 1, s)); c.lineWidth = s * .035; c.beginPath(); c.arc(0, r * .55, r * .2, .2, PI - .2); c.stroke();
  },
  zuckerkoenig(c, s) {
    const r = s * .36; glow(c, s, '#fff2c0', .95);
    body(c, s, '#fff6e6', { rx: 1.0, ry: 1.0 });
    c.fillStyle = 'rgba(200,200,220,.5)'; [[-.5, .5], [.4, .6], [.1, .15]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, s * .02, 0, 7); c.fill(); });
    pl(c, [[-r * .7, -r * .85], [-r * .75, -r * 1.5], [-r * .35, -r * 1.2], [0, -r * 1.6], [r * .35, -r * 1.2], [r * .75, -r * 1.5], [r * .7, -r * .85]], '#ffd24a');
    [-.7, 0, .7].forEach(k => ci(c, k * r * .95, -r * (k ? 1.45 : 1.55), s * .035, '#e0453a'));
    face(c, s, { mouth: 'grin', er: .17 }); ln(c, -r * .55, -r * .35, -r * .15, -r * .3, s * .04); ln(c, r * .55, -r * .35, r * .15, -r * .3, s * .04);
  },
  /* ===== Familie ===== */
  thore(c, s) {
    const r = s * .36, H = '#f2cf5a';
    pl(c, [[-r * .7, -r * .75], [-r * .55, -r * 1.35], [-r * .2, -r * .95], [0, -r * 1.5], [r * .2, -r * .95], [r * .55, -r * 1.35], [r * .7, -r * .75]], H);
    body(c, s, '#ffd9b8', { rx: .95, ry: .95 });
    c.beginPath(); c.moveTo(-r * .98, -r * .15); c.quadraticCurveTo(0, -r * 1.1, r * .98, -r * .15); c.quadraticCurveTo(r * .5, -r * .55, 0, -r * .6); c.quadraticCurveTo(-r * .5, -r * .55, -r * .98, -r * .15); c.closePath(); FS(c, H);
    face(c, s, { mouth: 'grin', er: .24, dy: .02 });
  },
  erik(c, s) {
    const r = s * .36, H = '#f2cf5a';
    body(c, s, '#ffd9b8');
    c.beginPath(); c.moveTo(-r * 1.02, -r * .05); c.bezierCurveTo(-r * 1.25, -r * 1.4, r * 1.25, -r * 1.4, r * 1.02, -r * .05); c.quadraticCurveTo(r * .55, -r * .5, r * .1, -r * .66); c.quadraticCurveTo(-r * .4, -r * .42, -r * 1.02, -r * .05); c.closePath(); FS(c, H);
    pl(c, [[r * .2, -r * 1.05], [r * .5, -r * 1.45], [r * .65, -r * .95]], H);
    face(c, s, { mouth: 'grin', dy: .0 }); c.fillStyle = 'rgba(190,110,70,.55)'; [[-.5, .3], [-.38, .38], [.5, .3], [.38, .38]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, s * .012, 0, 7); c.fill(); });
  },
  ida(c, s) {
    const r = s * .36, H = '#f2cf5a';
    [-1, 1].forEach(d => el(c, d * r * .98, r * .5, r * .34, r * 1.1, H, d * .08));
    body(c, s, '#ffd9b8');
    c.beginPath(); c.moveTo(-r * 1.03, r * .05); c.bezierCurveTo(-r * 1.3, -r * 1.4, r * 1.3, -r * 1.4, r * 1.03, r * .05); c.quadraticCurveTo(r * .75, -r * .45, r * .15, -r * .75); c.quadraticCurveTo(-r * .45, -r * .35, -r * 1.03, r * .05); c.closePath(); FS(c, H);
    c.lineWidth = s * .05; c.beginPath(); c.moveTo(-r * .85, -r * .52); c.quadraticCurveTo(0, -r * 1.05, r * .85, -r * .52); c.strokeStyle = '#ff7aa8'; c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .03;
    face(c, s, { mouth: 'smile' });
  },
  leif(c, s) {
    const r = s * .36, H = '#f2cf5a';
    body(c, s, '#ffd9b8');
    c.beginPath(); c.moveTo(-r * 1.04, -r * .02); c.bezierCurveTo(-r * 1.3, -r * 1.45, r * 1.3, -r * 1.45, r * 1.04, -r * .02); c.lineTo(r * .8, -r * .1); c.lineTo(r * .5, -r * .5); c.lineTo(r * .2, -r * .2); c.lineTo(-r * .1, -r * .52); c.lineTo(-r * .4, -r * .2); c.lineTo(-r * .75, -r * .45); c.closePath(); FS(c, H);
    pl(c, [[-r * .9, -r * .75], [-r * 1.3, -r * 1.05], [-r * .6, -r * 1.05]], H); pl(c, [[r * .3, -r * 1.2], [r * .8, -r * 1.45], [r * .75, -r * .95]], H);
    face(c, s, { mouth: 'flat', dy: .05, blush: 0 });
  },
  sandra(c, s) {
    const r = s * .36, H = '#f2cf5a';
    [-1, 1].forEach(d => el(c, d * r * .98, r * .65, r * .36, r * 1.3, H, d * .06));
    body(c, s, '#ffd9b8');
    c.beginPath(); c.moveTo(-r * 1.04, r * .1); c.bezierCurveTo(-r * 1.3, -r * 1.4, r * 1.3, -r * 1.4, r * 1.04, r * .1); c.quadraticCurveTo(r * .8, -r * .5, 0, -r * .8); c.quadraticCurveTo(-r * .8, -r * .5, -r * 1.04, r * .1); c.closePath(); FS(c, H);
    face(c, s, { mouth: 'smile' }); [-1, 1].forEach(d => ci(c, d * r * 1.02, r * .4, s * .028, '#ffd24a'));
  },
  alexander(c, s) {
    const r = s * .36, H = '#f2cf5a';
    body(c, s, '#ffd9b8', { rx: 1.06 });
    c.beginPath(); c.moveTo(-r * 1.06, -r * .12); c.bezierCurveTo(-r * 1.2, -r * 1.1, r * 1.2, -r * 1.1, r * 1.06, -r * .12); c.quadraticCurveTo(r * .6, -r * .55, 0, -r * .5); c.quadraticCurveTo(-r * .6, -r * .55, -r * 1.06, -r * .12); c.closePath(); FS(c, H);
    face(c, s, { mouth: 'smile', dy: -.02 }); c.fillStyle = 'rgba(150,110,60,.5)'; for (let i = 0; i < 14; i++) { const a = .35 + i * .19; c.beginPath(); c.arc(Math.cos(a) * r * .78, Math.sin(a) * r * .72 + r * .12, s * .011, 0, 7); c.fill(); }
  },
  lilli(c, s) {
    const r = s * .36;
    // Lilli: hellbraun-goldenes Fell, weiße Schnauze, Schlappohren, dunkles Halsband
    [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .6, -r * .65); c.bezierCurveTo(d * r * 1.45, -r * .85, d * r * 1.55, r * .45, d * r * 1.05, r * .8); c.bezierCurveTo(d * r * .9, r * .25, d * r * .85, -r * .2, d * r * .6, -r * .65); c.closePath(); FS(c, '#cf934a'); });
    body(c, s, '#e6aa5e');
    c.beginPath(); c.moveTo(-r * .08, -r * .7); c.quadraticCurveTo(-r * .1, -r * .1, -r * .3, r * .4); c.lineTo(r * .3, r * .4); c.quadraticCurveTo(r * .1, -r * .1, r * .08, -r * .7); c.closePath(); c.fillStyle = 'rgba(255,245,230,.55)'; c.fill();
    el(c, 0, r * .46, r * .55, r * .42, '#fff3e0'); ci(c, 0, r * .26, r * .13, '#2a2a33');
    [-1, 1].forEach(d => cEye(c, d * r * .4, -r * .12, r * .17, 1, s));
    c.lineWidth = s * .03; c.beginPath(); c.moveTo(0, r * .38); c.lineTo(0, r * .52); c.moveTo(-r * .2, r * .52); c.quadraticCurveTo(0, r * .66, r * .2, r * .52); c.stroke(); el(c, 0, r * .68, r * .1, r * .12, '#ff8aa0');
    c.lineWidth = s * .05; c.strokeStyle = '#3a2a22'; c.beginPath(); c.arc(0, 0, r * 1.0, .62, PI - .62); c.stroke(); c.strokeStyle = INK; c.lineWidth = s * .03; ci(c, 0, r * 1.0, s * .03, '#cfd6e4');
  },
  lexi(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => { pl(c, [[d * r * .25, -r * .85], [d * r * .8, -r * 1.55], [d * r * 1.05, -r * .45]], '#8e98a3'); pl(c, [[d * r * .42, -r * .9], [d * r * .75, -r * 1.25], [d * r * .88, -r * .65]], '#f3b6c4'); });
    body(c, s, '#a2abb5');
    c.strokeStyle = 'rgba(70,80,95,.55)'; c.lineWidth = s * .03; [-1, 0, 1].forEach(k => { c.beginPath(); c.moveTo(k * r * .3, -r * .98); c.lineTo(k * r * .3, -r * .62); c.stroke(); }); c.strokeStyle = INK;
    face(c, s, { mouth: 'flat', dy: -.05 }); pl(c, [[-r * .08, r * .22], [r * .08, r * .22], [0, r * .34]], '#f3a0b4');
    c.lineWidth = s * .02; [-1, 1].forEach(d => [0, 1].forEach(k => ln(c, d * r * .25, r * .35 + k * r * .1, d * r * .95, r * .22 + k * r * .3)));
  },
  finni(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => { pl(c, [[d * r * .25, -r * .85], [d * r * .8, -r * 1.55], [d * r * 1.05, -r * .45]], '#ffffff'); pl(c, [[d * r * .42, -r * .9], [d * r * .75, -r * 1.25], [d * r * .88, -r * .65]], '#ffb6c8'); });
    body(c, s, '#ffffff');
    face(c, s, { mouth: 'smile', dy: -.05 }); pl(c, [[-r * .08, r * .22], [r * .08, r * .22], [0, r * .34]], '#ff8aa8');
    c.lineWidth = s * .02; [-1, 1].forEach(d => [0, 1].forEach(k => ln(c, d * r * .25, r * .35 + k * r * .1, d * r * .95, r * .22 + k * r * .3, null, '#9aa3b5')));
  },
  ursel(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => { pl(c, [[d * r * .25, -r * .85], [d * r * .8, -r * 1.55], [d * r * 1.05, -r * .45]], '#3a281d'); pl(c, [[d * r * .42, -r * .9], [d * r * .75, -r * 1.25], [d * r * .88, -r * .65]], '#b98a74'); });
    body(c, s, '#5a3d2b');
    c.fillStyle = 'rgba(25,15,10,.55)'; c.beginPath(); c.ellipse(-r * .5, -r * .5, r * .35, r * .25, .4, 0, 7); c.fill(); c.beginPath(); c.ellipse(r * .55, r * .35, r * .3, r * .38, -.3, 0, 7); c.fill();
    el(c, 0, r * .55, r * .22, r * .17, '#ffffff');
    [-1, 1].forEach(d => cEye(c, d * r * .36, -r * .1, r * .17, 1, s)); pl(c, [[-r * .08, r * .22], [r * .08, r * .22], [0, r * .34]], '#e8a0a8');
    c.lineWidth = s * .02; [-1, 1].forEach(d => [0, 1].forEach(k => ln(c, d * r * .25, r * .35 + k * r * .1, d * r * .95, r * .22 + k * r * .3, null, '#d8c8b8')));
  },
  /* ===== Dino ===== */
  raptor(c, s) {
    const r = s * .36;
    for (let i = 0; i < 4; i++) pl(c, [[-r * .4 + i * r * .27, -r * .85], [-r * .28 + i * r * .27, -r * 1.35], [-r * .12 + i * r * .27, -r * .85]], '#f0a24a');
    body(c, s, '#74c35a', { rx: 1.0 });
    el(c, r * .15, r * .38, r * .6, r * .32, '#d6f0a8');
    [-1, 1].forEach(d => cEye(c, d * r * .36, -r * .15, r * .17, .9, s));
    c.lineWidth = s * .04; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * (r * .36 + r * .24), -r * .5); c.lineTo(d * (r * .36 - r * .2), -r * .3); c.stroke(); });
    c.lineWidth = s * .03; c.beginPath(); c.moveTo(-r * .45, r * .38); c.lineTo(r * .6, r * .38); c.stroke(); [-.2, .1, .4].forEach(k => pl(c, [[k * r, r * .38], [k * r + r * .09, r * .56], [k * r + r * .18, r * .38]], '#fff'));
  },
  fossil(c, s) {
    const r = s * .36;
    body(c, s, '#e8dcc0');
    c.strokeStyle = 'rgba(120,100,70,.55)'; c.lineWidth = s * .03; c.beginPath(); c.moveTo(-r * .2, -r * .98); c.lineTo(-r * .05, -r * .62); c.lineTo(-r * .3, -r * .4); c.moveTo(r * .75, r * .35); c.lineTo(r * .5, r * .55); c.lineTo(r * .65, r * .8); c.stroke(); c.strokeStyle = INK;
    ln(c, r * .4, -r * .9, r * .85, -r * .5, s * .05, '#fff7e4'); ci(c, r * .38, -r * .93, s * .035, '#fff7e4'); ci(c, r * .88, -r * .47, s * .035, '#fff7e4');
    face(c, s, { mouth: 'flat', dy: -.02 });
  },
  trike(c, s) {
    const r = s * .36;
    c.beginPath(); c.moveTo(-r * 1.3, r * .2); c.bezierCurveTo(-r * 1.5, -r * 1.7, r * 1.5, -r * 1.7, r * 1.3, r * .2); c.closePath(); FS(c, '#f0a24a');
    [-1, -.5, 0, .5, 1].forEach(k => { c.beginPath(); c.arc(k * r * 1.05, -r * (1.1 - Math.abs(k) * .5), s * .02, 0, 7); c.fillStyle = '#c7681f'; c.fill(); });
    body(c, s, '#86bf6a');
    [-1, 1].forEach(d => pl(c, [[d * r * .45, -r * .55], [d * r * .8, -r * 1.35], [d * r * .78, -r * .45]], '#fff7e4')); pl(c, [[-r * .1, r * .05], [0, -r * .5], [r * .1, r * .05]], '#fff7e4');
    face(c, s, { mouth: 'flat', dy: .1, angry: 1 });
  },
  ptero(c, s) {
    const r = s * .36;
    [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * r * .7, -r * .1); c.quadraticCurveTo(d * r * 1.6, -r * 1.5, d * r * 2.2, -r * .5); c.quadraticCurveTo(d * r * 1.9, -r * .35, d * r * 1.8, -r * .05); c.quadraticCurveTo(d * r * 1.55, -r * .25, d * r * 1.35, r * .1); c.quadraticCurveTo(d * r * 1.1, -r * .1, d * r * .9, r * .2); c.closePath(); FS(c, '#e0a46a'); });
    pl(c, [[-r * .35, -r * .85], [-r * 1.0, -r * 1.55], [-r * .05, -r * .95]], '#d7513a');
    body(c, s, '#c98a5a');
    pl(c, [[-r * .3, r * .15], [r * 1.2, r * .35], [-r * .3, r * .55]], '#f0cf8a');
    [-1, 1].forEach(d => cEye(c, d * r * .3, -r * .22, r * .16, .9, s));
  },
  stego(c, s) {
    const r = s * .36;
    [[-.75, -.7, .0], [-.38, -1.0, -.1], [0, -1.1, 0], [.38, -1.0, .1], [.75, -.7, .0]].forEach(p => pl(c, [[p[0] * r - r * .24, p[1] * r + r * .35], [p[0] * r, p[1] * r - r * .3], [p[0] * r + r * .24, p[1] * r + r * .35]], '#f0a24a'));
    body(c, s, '#8cc271', { rx: 1.05 });
    el(c, 0, r * .45, r * .62, r * .3, '#d6f0a8');
    [-1, 1].forEach(d => cEye(c, d * r * .38, -r * .12, r * .17, 1, s)); c.lineWidth = s * .03; c.beginPath(); c.arc(0, r * .3, r * .2, .2, PI - .2); c.stroke();
    [-1, 1].forEach(d => pl(c, [[d * r * .75, r * .75], [d * r * 1.1, r * 1.15], [d * r * .95, r * .6]], '#fff7e4'));
  },
  anky(c, s) {
    const r = s * .36;
    ci(c, r * 1.15, r * .55, r * .45, '#8a7a5a'); [0, 1, 2, 3, 4].forEach(i => { const a = i * 1.25; spike(c, r * 1.15 + Math.cos(a) * r * .4, r * .55 + Math.sin(a) * r * .4, a + 1.57, s * .09, s * .04, '#e8dcc0'); });
    body(c, s, '#9a8a6a', { rx: 1.05 });
    c.strokeStyle = 'rgba(60,50,35,.6)'; c.lineWidth = s * .03; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * r * .4, -r * .98); c.lineTo(i * r * .4 + r * .12, -r * .5); c.stroke(); } c.beginPath(); c.moveTo(-r * .9, -r * .55); c.lineTo(r * .9, -r * .55); c.stroke(); c.strokeStyle = INK;
    [-1, 1].forEach(d => pl(c, [[d * r * .85, -r * .4], [d * r * 1.15, -r * .6], [d * r * 1.0, -r * .2]], '#e8dcc0'));
    face(c, s, { mouth: 'flat', angry: 1, dy: .1 });
  },
  brachio(c, s) {
    const r = s * .36;
    el(c, -r * .35, -r * .95, r * .4, r * 1.0, '#7bbf8a', .25); ci(c, -r * .55, -r * 1.85, r * .38, '#7bbf8a');
    [0].forEach(() => { cEye(c, -r * .62, -r * 1.9, r * .12, 1, s); c.lineWidth = s * .025; c.beginPath(); c.arc(-r * .58, -r * 1.72, r * .12, .3, PI - .3); c.stroke(); });
    body(c, s, '#7bbf8a', { rx: 1.1 });
    c.strokeStyle = 'rgba(40,90,60,.45)'; c.lineWidth = s * .03; [[.4, .2], [.7, -.3], [.1, .6]].forEach(p => { c.beginPath(); c.arc(p[0] * r, p[1] * r, r * .16, 0, 7); c.stroke(); }); c.strokeStyle = INK;
    [-1, 1].forEach(d => cEye(c, d * r * .25 + r * .25, r * .0, r * .17, 1, s)); c.lineWidth = s * .03; c.beginPath(); c.arc(r * .25, r * .35, r * .2, .2, PI - .2); c.stroke();
  },
  trex(c, s) {
    const r = s * .36;
    for (let i = 0; i < 5; i++) pl(c, [[-r * .65 + i * r * .33, -r * .85], [-r * .5 + i * r * .33, -r * 1.35], [-r * .35 + i * r * .33, -r * .85]], '#e0793a');
    body(c, s, '#5fae4a', { rx: 1.08, ry: 1.0 });
    el(c, 0, r * .5, r * .75, r * .32, '#cfe8a0');
    [-1, 1].forEach(d => { ln(c, d * r * .85, r * .45, d * r * 1.05, r * .75, s * .06, '#5fae4a'); });
    [-1, 1].forEach(d => cEye(c, d * r * .38, -r * .22, r * .17, .9, s));
    c.lineWidth = s * .045; [-1, 1].forEach(d => { c.beginPath(); c.moveTo(d * (r * .38 + r * .26), -r * .58); c.lineTo(d * (r * .38 - r * .22), -r * .36); c.stroke(); });
    c.lineWidth = s * .035; c.beginPath(); c.moveTo(-r * .62, r * .32); for (let i = 0; i <= 6; i++) c.lineTo(-r * .62 + i * r * .207, r * .32 + (i % 2 ? r * .02 : r * .2)); c.stroke();
    [-2, -1, 0, 1, 2].forEach(k => pl(c, [[k * r * .24 - r * .07, r * .34], [k * r * .24, r * .5], [k * r * .24 + r * .07, r * .34]], '#fff'));
  }
};

/* ---------- Teile und Geschosse (zeigen nach rechts) ---------- */
// [Entwurfsradius, Zeichenfunktion, Ausdehnung der Fläche (Vielfaches des Radius)]
export const OB = {
  candy: [6, c => { ci(c, 0, 0, 6, '#ff7ab8'); c.lineWidth = 1.6; c.strokeStyle = '#fff'; c.beginPath(); c.arc(0, 0, 3, 0, 5); c.stroke(); c.strokeStyle = INK; pl(c, [[-6, -2], [-11, -5], [-11, 5], [-6, 2]], '#ffd0e6'); }, 4],
  spike: [20, (c, s) => { spike(c, 0, 16, 0, 40, 14, '#d6dae2'); }, 3],
  bullet: [4, c => ci(c, 0, 0, 4, '#5b6270'), 6],
  laser: [4, c => { c.lineWidth = 3.2; ln(c, -8, 0, 8, 0, 4, '#ff5a6a'); ln(c, -8, 0, 8, 0, 1.6, '#ffe0e4'); }, 6],
  pfeil: [4, c => { ln(c, -12, 0, 10, 0, 3, '#7a4a21'); pl(c, [[10, -4], [17, 0], [10, 4]], '#d6dae2'); pl(c, [[-12, 0], [-16, -5], [-9, 0], [-16, 5]], '#d33a3a'); }, 6],
  bolt: [5, c => { glowDot(c, 0, 0, 9, '#a98ae0'); ci(c, 0, 0, 4.5, '#f0e4ff'); stars(c, [[0, 0, 4]], '#ffffff'); }, 5],
  slime: [6, c => { c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(-4, -8, 3, -6); c.quadraticCurveTo(9, -2, 6, 5); c.quadraticCurveTo(0, 9, -6, 0); FS(c, '#9be86e'); dot(c, 1, -1, 1.8, '#fff'); }, 4],
  kern: [4, c => { el(c, 0, 0, 5, 3, '#e6d9a0'); }, 6],
  toast: [7, c => { c.beginPath(); c.rect(-6, -6, 12, 12); FS(c, '#f0c47c'); c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fillStyle = '#b9803a'; c.fill(); }, 4],
  messer: [4, c => { pl(c, [[-8, -2], [8, -2], [14, 2], [-8, 2]], '#f1f4f8'); pl(c, [[-16, -2.5], [-8, -2.5], [-8, 2.5], [-16, 2.5]], '#7a4a21'); }, 6],
  chili: [5, c => { c.beginPath(); c.moveTo(-9, -4); c.quadraticCurveTo(2, -8, 10, 0); c.quadraticCurveTo(0, 7, -9, 3); c.closePath(); FS(c, '#e0392b'); pl(c, [[-9, -4], [-13, -6], [-12, 0], [-9, 3]], '#3f9a45'); }, 5],
  gold: [5, c => { glowDot(c, 0, 0, 10, '#ffd24a'); stars(c, [[0, 0, 7]], '#ffe27a'); }, 5],
  shard: [4, c => { pl(c, [[-8, 0], [0, -4], [9, 0], [0, 4]], '#e6b8ff'); }, 6],
  bat: [6, c => { pl(c, [[0, 0], [-4, -9], [-1, -4], [3, -10], [5, -2], [9, -6], [10, 2], [0, 4]], '#4a3566'); dot(c, 3, -1, 1.2, '#ffe36a'); }, 4],
  wisp: [5, c => { glowDot(c, 0, 0, 10, '#a8f0ff'); c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-2, -7, 6, 0); c.quadraticCurveTo(-2, 7, -8, 0); FS(c, '#e6fcff'); dot(c, 2, -1, 1.2); }, 5],
  tennis: [6, c => { ci(c, 0, 0, 6, '#d4ec4a'); c.lineWidth = 1.4; c.strokeStyle = '#fff'; c.beginPath(); c.arc(-7, 0, 6, -.8, .8); c.stroke(); c.beginPath(); c.arc(7, 0, 6, PI - .8, PI + .8); c.stroke(); }, 4],
  slice: [8, c => { pl(c, [[-7, -7], [8, 0], [-7, 7]], '#f6c75a'); dot(c, -1, -2, 1.6, '#d6402f'); dot(c, 1, 3, 1.6, '#d6402f'); ln(c, -7, -7, -7, 7, 3, '#b9803a'); }, 4],
  yoyo: [8, c => { ci(c, 0, 0, 8, '#e0453a'); ci(c, 0, 0, 3.5, '#fff2c0'); }, 4],
  bone: [7, c => { ln(c, -7, 0, 7, 0, 4, '#f1ecdc'); ci(c, -8, -2.5, 2.5, '#f1ecdc'); ci(c, -8, 2.5, 2.5, '#f1ecdc'); ci(c, 8, -2.5, 2.5, '#f1ecdc'); ci(c, 8, 2.5, 2.5, '#f1ecdc'); }, 4],
  sense: [13, c => { c.beginPath(); c.moveTo(-12, 8); c.quadraticCurveTo(-14, -10, 6, -12); c.quadraticCurveTo(-6, -5, -2, 8); c.closePath(); FS(c, '#cfd6e2'); ln(c, -4, 10, -2, -2, 3, '#7a4a21'); }, 3],
  frost2: [6, c => { pl(c, [[-8, 0], [0, -6], [10, 0], [0, 6]], '#bdeaff'); stars(c, [[0, 0, 4]], '#fff'); }, 5],
  frost: [5, c => { pl(c, [[-8, 0], [0, -5], [9, 0], [0, 5]], '#bdeaff'); }, 5],
  bee: [5, c => { el(c, 0, 0, 6, 4.5, '#ffd84a'); ln(c, -1, -4.2, -1, 4.2, 2, INK); ln(c, 2.5, -3.6, 2.5, 3.6, 2, INK); el(c, -2, -5, 3, 2, 'rgba(220,240,255,.9)', .5); }, 4],
  saw: [9, c => { c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, q = i % 2 ? 6.5 : 9.5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); FS(c, '#cfd6e2'); ci(c, 0, 0, 2.6, '#8a8f99'); }, 3],
  boom: [8, c => { c.beginPath(); c.moveTo(-8, -3); c.quadraticCurveTo(0, -10, 8, -3); c.lineTo(5, 0); c.quadraticCurveTo(0, -5, -5, 0); c.closePath(); FS(c, '#e8b85a'); }, 3],
  bomb: [9, c => { ci(c, 0, 2, 8, '#4a4f5a'); ln(c, 0, -6, 3, -10, 2.4); stars(c, [[4, -11, 3.5]], '#ffd45a'); }, 3],
  meteor: [10, c => { ci(c, 0, 0, 9, '#8e7a6a'); ci(c, -3, -2, 2.6, '#6e5e50'); }, 3],
  blitz: [14, c => { c.beginPath(); c.moveTo(3, -60); c.lineTo(-7, -28); c.lineTo(1, -28); c.lineTo(-6, 0); c.lineTo(10, -34); c.lineTo(2, -34); c.lineTo(10, -60); c.closePath(); FS(c, '#fff6a0'); }, 6],
  potion: [9, c => { c.beginPath(); c.moveTo(-3, -9); c.lineTo(3, -9); c.lineTo(3, -4); c.quadraticCurveTo(10, 0, 7, 7); c.quadraticCurveTo(0, 11, -7, 7); c.quadraticCurveTo(-10, 0, -3, -4); c.closePath(); FS(c, '#9be86e'); }, 3],
  ufomine: [8, c => { el(c, 0, 0, 8, 4, '#aab3c2'); dot(c, -3, -.5, 1.4, '#ff6a8a'); dot(c, 3, -.5, 1.4, '#ffd45a'); }, 3],
  brick: [9, c => { c.beginPath(); c.rect(-9, -5, 18, 11); FS(c, '#e0453a'); ci(c, -4, -7, 2.6, '#e0453a'); ci(c, 4, -7, 2.6, '#e0453a'); }, 3],
  rainZone: [30, c => zoneRing(c, 30, '#6cc4ee'), 2.4],
  lavaZone: [30, c => zoneRing(c, 30, '#ff7a1a'), 2.4],
  dustZone: [30, c => zoneRing(c, 30, '#bfe4ff'), 2.4],
  eggZone: [30, c => { zoneRing(c, 30, '#fff7e4'); ci(c, 0, 0, 9, '#ffc83a'); }, 2.4],
  platteZone: [30, c => { zoneRing(c, 30, '#ff9a3a'); zoneRing(c, 20, '#ffd24a'); }, 2.4],
  brewZone: [30, c => { zoneRing(c, 30, '#9be86e'); ci(c, -8, -6, 4, '#c6ff8a'); ci(c, 9, 7, 3, '#c6ff8a'); }, 2.4],
  puddleZone: [30, c => zoneRing(c, 30, '#9be86e'), 2.4],
  fireZone: [14, c => { flame(c, 0, 8, 8, 20, '#ff8a2a', '#ffd24a'); }, 3],
  star: [10, c => stars(c, [[0, 0, 10]], '#ffd45a'), 3]
};
function glowDot(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(col, .7)); g.addColorStop(1, hexA(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function zoneRing(c, r, col) { c.save(); c.globalAlpha = .55; c.beginPath(); c.ellipse(0, 0, r, r * .92, 0, 0, 7); c.fillStyle = col; c.fill(); c.globalAlpha = 1; c.lineWidth = Math.max(1.4, r * .06); c.stroke(); c.restore(); }

/* ---------- bewegliche Teile der Bälle ---------- */
export const PARTS = {
  dagger: [14, c => { pl(c, [[2, -3], [22, 0], [2, 3]], '#eef2f8'); pl(c, [[0, -6], [3, -6], [3, 6], [0, 6]], '#7a4a21'); }],
  sawdisc: [20, c => { c.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, q = i % 2 ? 15 : 19; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); FS(c, '#cfd6e2'); ci(c, 0, 0, 5, '#8a8f99'); }],
  moon: [10, c => { ci(c, 0, 0, 9, '#f3eac0'); ci(c, -2, -2, 2.2, '#ddd3a2'); ci(c, 3, 3, 1.6, '#ddd3a2'); }],
  blade: [18, c => { el(c, 12, 0, 12, 4, '#cfd6e2'); ci(c, 0, 0, 2.6, '#8a8f99'); }],
  pan: [24, c => { c.beginPath(); c.ellipse(0, 0, 13, 18, 0, 0, 7); FS(c, '#585d68'); c.beginPath(); c.ellipse(0, 0, 9, 14, 0, 0, 7); c.fillStyle = '#7a8090'; c.fill(); }],
  shieldarc: [30, c => { c.lineWidth = 7; c.strokeStyle = INK; c.beginPath(); c.arc(0, 0, 26, -.8, .8); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#9fb3cf'; c.beginPath(); c.arc(0, 0, 26, -.8, .8); c.stroke(); }],
  swirl: [20, c => { c.lineWidth = 3; for (let k = 0; k < 2; k++) { c.beginPath(); c.arc(0, 0, 12 + k * 7, k * 3, k * 3 + 3.6); c.stroke(); } }]
};

/* ---------- Stufen der Wirkung eines Balls auf die Fläche (Rahmen) ---------- */
export const BALL_EXT = { riese: 1.2, drache: 1.1 };
