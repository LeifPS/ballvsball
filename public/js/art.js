// Alle Zeichnungen des Spiels: 25 Bälle, ihre Teile, Geschosse, Symbole.
import {
  INK, PAPER, BROWN, g, setTarget, mulberry, mix, Zmk, line, poly, curve, lopsided, circPoly, ring, wash, hatchPoly, dot, mkSprite, spr, T
} from './pen.js';
import { DEFS, RARITY } from './balls.js';

export const R0 = 24;
const RC = k => RARITY[k].color;

/* ---------- Gesichter ---------- */
function eyes(Z, o) {
  o = o || {};
  const sp = (o.sp || .33) * R0, ey = (o.dy == null ? -.12 : o.dy) * R0, er = (o.er || .2) * R0;
  [-1, 1].forEach(s => {
    const er2 = (o.small && s > 0) ? er * .6 : er;
    const rf = lopsided(Z, er2, .8), P = circPoly(rf, s * sp, ey, 14);
    wash(Z, P, o.col || '#fffdf6', 1.2);
    ring(Z, rf, s * sp, ey, 1.6, INK);
    dot(Z, s * sp - s * er2 * .2, ey + er2 * .1, er2 * (o.pupilK || .45), o.pupil || INK);
    if (o.angry) line(Z, s * (sp + er * 1.2), ey - er * 1.9, s * (sp - er * .9), ey - er * .8, 2, INK, { over: 1, bow: .1 });
    if (o.worry) line(Z, s * (sp + er * 1.1), ey - er * 1.0, s * (sp - er * .9), ey - er * 1.9, 2, INK, { over: 1, bow: .1 });
    if (o.sleepy) line(Z, s * sp - er * 1.1, ey - er * .6, s * sp + er * 1.1, ey - er * .6, 2.2, INK, { over: 1 });
  });
}
function mouth(Z, kind) {
  if (kind === 'flat') line(Z, -.25 * R0, .36 * R0, .25 * R0, .33 * R0, 1.9, INK, { over: 1 });
  else if (kind === 'frown') curve(Z, [[-.24 * R0, .42 * R0], [0, .26 * R0], [.24 * R0, .42 * R0]], 1.9, INK);
  else if (kind === 'o') ring(Z, lopsided(Z, .09 * R0, .8), 0, .36 * R0, 1.6, INK);
  else if (kind === 'zig') poly(Z, [[-.3, .36], [-.18, .28], [-.06, .4], [.06, .28], [.18, .4], [.3, .3]].map(p => [p[0] * R0, p[1] * R0]), 1.8, INK, false, { over: .8, bow: 0 });
  else if (kind === 'grin') {
    const P = [[-.3 * R0, .26 * R0], [0, .52 * R0], [.3 * R0, .26 * R0]];
    curve(Z, P, 2, INK); line(Z, -.3 * R0, .26 * R0, .3 * R0, .26 * R0, 1.6, INK, { over: .5 });
  } else if (kind === 'tongue') {
    curve(Z, [[-.22 * R0, .26 * R0], [0, .4 * R0], [.24 * R0, .25 * R0]], 1.9, INK);
    const P = [[.02 * R0, .36 * R0], [.2 * R0, .34 * R0], [.16 * R0, .56 * R0], [.06 * R0, .56 * R0]];
    wash(Z, P, '#f58aa0', 1); poly(Z, P, 1.4, INK, true, { over: .6 });
  } else curve(Z, [[-.22 * R0, .26 * R0], [0, .42 * R0], [.24 * R0, .25 * R0]], 1.9, INK);
}
function shade(h, k) {
  const a = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  return 'rgb(' + a.map(v => Math.round(v * (1 - k))).join(',') + ')';
}
function bodyBase(Z, col, fill, hatchCol) {
  const rf = lopsided(Z, R0), P = circPoly(rf, 0, 0, 40);
  wash(Z, P, fill);
  hatchPoly(Z, P, hatchCol || shade(fill, .16), -.9, 4.6, 1.5, {});
  hatchPoly(Z, P, hatchCol || shade(fill, .1), .75, 6.5, 1.3, { from: .42 });
  ring(Z, rf, 0, 0, 2.9, INK);
  ring(Z, rf, 0, 0, 1.3, BROWN, { turns: .4 });
  curve(Z, [[-.58 * R0, -.28 * R0], [-.48 * R0, -.5 * R0], [-.26 * R0, -.64 * R0]], 2.5, '#fffdf2');
  return rf;
}
function tri(Z, P, fill, hatch, w) {
  wash(Z, P, fill, 1.2); if (hatch) hatchPoly(Z, P, hatch, -.9, 3, 1.1, {});
  poly(Z, P, w || 1.8, INK, true, { over: .8, bow: .05 });
}
const K = R0;
const BODIES = {
  stachel: { fill: '#e6e0d4', face(Z) { eyes(Z, { angry: 1 }); mouth(Z, 'flat'); } },
  turret: {
    fill: '#d6d9dc', face(Z) {
      eyes(Z, {}); mouth(Z, 'smile');
      dot(Z, -.62 * K, .3 * K, 1.8); dot(Z, .62 * K, .3 * K, 1.8);
    }
  },
  ramm: {
    fill: '#cfa57a', face(Z) {
      [-1, 1].forEach(s => tri(Z, [[s * .45 * K, -.7 * K], [s * .75 * K, -1.3 * K], [s * .85 * K, -.5 * K]], '#fffdf6', '#cfc8b8'));
      eyes(Z, { angry: 1, er: .17, sp: .3 }); mouth(Z, 'frown');
    }
  },
  glas: {
    fill: '#dff3fb', hatch: '#9ed4ea', face(Z) {
      eyes(Z, { er: .22, pupilK: .3 }); mouth(Z, 'o');
      poly(Z, [[.1 * K, -.95 * K], [.25 * K, -.55 * K], [.12 * K, -.3 * K], [.3 * K, 0]], 1.4, INK, false, { over: .4, bow: 0 });
      curve(Z, [[-.7 * K, .35 * K], [-.5 * K, .6 * K], [-.25 * K, .75 * K]], 2, '#ffffff');
    }
  },
  feuer: {
    fill: '#ffb15a', hatch: '#e0582a', face(Z) { eyes(Z, { angry: 0 }); mouth(Z, 'grin'); }
  },
  bumerang: {
    fill: '#ffe08a', face(Z) {
      eyes(Z, {}); mouth(Z, 'smile');
      curve(Z, [[-.5 * K, -.78 * K], [-.1 * K, -.95 * K], [.5 * K, -.75 * K]], 4, '#9a6a2a');
      curve(Z, [[-.5 * K, -.78 * K], [-.1 * K, -.95 * K], [.5 * K, -.75 * K]], 1.2, INK);
    }
  },
  magnet: {
    fill: '#d6d9dc', face(Z) {
      eyes(Z, { dy: -.05 }); mouth(Z, 'smile');
      const U = [[-.4 * K, -.78 * K], [-.4 * K, -1.25 * K], [-.1 * K, -1.35 * K], [.1 * K, -1.35 * K], [.4 * K, -1.25 * K], [.4 * K, -.78 * K]];
      curve(Z, U, 7, '#d33a3a'); curve(Z, U, 1.4, INK);
      line(Z, -.4 * K, -.78 * K, -.4 * K, -.95 * K, 7, '#f2f2f2', { over: 0 });
      line(Z, .4 * K, -.78 * K, .4 * K, -.95 * K, 7, '#f2f2f2', { over: 0 });
    }
  },
  schwert: {
    fill: '#cfe3fb', face(Z) {
      eyes(Z, { angry: 1, dy: -.05 }); mouth(Z, 'smile');
      line(Z, -.95 * K, -.5 * K, .95 * K, -.58 * K, 4.5, '#d33a3a', { over: .6, bow: .1 });
      poly(Z, [[.9 * K, -.5 * K], [1.3 * K, -.3 * K], [1.15 * K, -.75 * K]], 1.6, '#d33a3a', false, { over: 0 });
    }
  },
  zelle: {
    fill: '#e1d2f3', face(Z) {
      const rf = lopsided(Z, K * .32), P = circPoly(rf, K * .1, -K * .05, 18);
      wash(Z, P, mix('#8b4fc9', .3), 2); ring(Z, rf, K * .1, -K * .05, 2, INK); dot(Z, K * .1, -K * .05, K * .1);
      [[-.5, .35, .14], [.45, .4, .12], [-.4, -.45, .1], [.5, -.4, .08]].forEach(c => {
        const r2 = lopsided(Z, K * c[2], .8);
        wash(Z, circPoly(r2, c[0] * K, c[1] * K, 10), mix('#8b4fc9', .55), 1.2); ring(Z, r2, c[0] * K, c[1] * K, 1.3, INK);
      });
    }
  },
  spinne: {
    fill: '#4a4a4a', hatch: '#2a2a2a', face(Z) {
      eyes(Z, { angry: 1, col: '#ffb3b3', pupil: '#b00020', er: .19 });
      line(Z, -.1 * K, .34 * K, -.28 * K, .58 * K, 1.8, '#fffdf6', { over: 1 }); line(Z, .1 * K, .34 * K, .28 * K, .58 * K, 1.8, '#fffdf6', { over: 1 });
      [-1, 1].forEach(s => { dot(Z, s * .12 * K, -.55 * K, 1.8, '#b00020'); dot(Z, s * .3 * K, -.6 * K, 1.4, '#b00020'); });
    }
  },
  schmied: {
    fill: '#a98763', face(Z) {
      eyes(Z, { angry: 1 }); curve(Z, [[-.3 * K, .3 * K], [-.12 * K, .22 * K], [0, .3 * K]], 2.2, INK); curve(Z, [[0, .3 * K], [.12 * K, .22 * K], [.3 * K, .3 * K]], 2.2, INK);
      const A = [[-.3 * K, .55 * K], [.3 * K, .55 * K], [.22 * K, .72 * K], [-.22 * K, .72 * K]];
      tri(Z, A, '#8a8f99', '#5d626b', 1.5);
    }
  },
  bombe: {
    fill: '#4a4f5a', hatch: '#2b2f38', face(Z) {
      eyes(Z, { worry: 1, col: '#fffdf6' }); mouth(Z, 'frown');
      curve(Z, [[0, -.95 * K], [.1 * K, -1.25 * K], [.4 * K, -1.35 * K]], 2.4, INK);
    }
  },
  schild: {
    fill: '#cfd8e6', face(Z) {
      eyes(Z, { er: .17, sp: .3, dy: -.06 }); mouth(Z, 'flat');
      curve(Z, [[-.3 * K, -.95 * K], [0, -1.5 * K], [.3 * K, -.95 * K]], 4, '#3b7fd4'); curve(Z, [[-.3 * K, -.95 * K], [0, -1.5 * K], [.3 * K, -.95 * K]], 1.3, INK);
    }
  },
  echo: {
    fill: '#ece1f8', face(Z) {
      ring(Z, lopsided(Z, K * 1.12, 1), 0, 0, 1.2, '#b9a2d6', { turns: .9 });
      eyes(Z, { er: .21 }); mouth(Z, 'o');
    }
  },
  gift: {
    fill: '#b9e27a', hatch: '#6fae2e', face(Z) {
      eyes(Z, { small: 1, pupilK: .35 }); mouth(Z, 'tongue');
      [[-.55, -.5, 3], [.55, -.35, 2.4], [.2, .75, 2.2]].forEach(c => { const r = lopsided(Z, c[2]); ring(Z, r, c[0] * K, c[1] * K, 1.2, INK); });
      [[-.5, .88], [.45, .9]].forEach(c => tri(Z, [[c[0] * K - 3, c[1] * K - 3], [c[0] * K + 3, c[1] * K - 3], [c[0] * K, c[1] * K + 5]], '#b9e27a', null, 1.3));
    }
  },
  vampir: {
    fill: '#efe3ff', face(Z) {
      eyes(Z, { pupil: '#b0001c' });
      [-1, 1].forEach(s => tri(Z, [[s * .1 * K, .28 * K], [s * .26 * K, .28 * K], [s * .17 * K, .58 * K]], '#fffdf6', null, 1.6));
      poly(Z, [[-.6 * K, -.68 * K], [-.2 * K, -.5 * K], [0, -.2 * K], [.2 * K, -.5 * K], [.6 * K, -.68 * K], [.4 * K, -1.0 * K], [0, -.92 * K], [-.4 * K, -1.0 * K]], 2, INK, true, { over: .6 });
      wash(Z, [[-.6 * K, -.68 * K], [-.2 * K, -.5 * K], [0, -.2 * K], [.2 * K, -.5 * K], [.6 * K, -.68 * K], [.4 * K, -1.0 * K], [0, -.92 * K], [-.4 * K, -1.0 * K]], '#3a2a4a', 1);
    }
  },
  riese: {
    fill: '#b9cfa0', hatch: '#7da060', face(Z) {
      eyes(Z, { angry: 1, er: .15, sp: .32 }); mouth(Z, 'frown');
      line(Z, -.62 * K, -.55 * K, -.28 * K, -.1 * K, 2, '#8a4a3a', { over: .5, bow: .1 });
      line(Z, -.55 * K, -.3 * K, -.4 * K, -.5 * K, 1.4, '#8a4a3a', { over: .3, bow: .1 });
      tri(Z, [[-.12 * K, .3 * K], [.04 * K, .3 * K], [-.04 * K, .52 * K]], '#fffdf6', null, 1.3);
    }
  },
  saege: {
    fill: '#d3d3d3', face(Z) { eyes(Z, { angry: 1 }); mouth(Z, 'zig'); }
  },
  schwarm: {
    fill: '#ffd84a', hatch: '#e0a800', face(Z) {
      [-.45, .05, .55].forEach(y => curve(Z, [[-.95 * K * Math.sqrt(Math.max(0, 1 - y * y)) + 2, y * K], [0, (y + .05) * K], [.95 * K * Math.sqrt(Math.max(0, 1 - y * y)) - 2, y * K]], 4, 'rgba(43,33,24,.85)'));
      eyes(Z, { dy: -.62 + .1, er: .17, sp: .26 }); mouth(Z, 'smile');
      [-1, 1].forEach(s => { curve(Z, [[s * .15 * K, -.95 * K], [s * .3 * K, -1.35 * K], [s * .5 * K, -1.45 * K]], 1.6, INK); dot(Z, s * .5 * K, -1.45 * K, 2.2); });
    }
  },
  eis: {
    fill: '#d4f1ff', hatch: '#8fd0ee', face(Z) {
      eyes(Z, { er: .19 }); mouth(Z, 'flat');
      [[-.5, -.82, -.35, -1.3, -.15, -.9], [-.15, -.95, 0, -1.55, .15, -.95], [.2, -.9, .4, -1.3, .55, -.8]].forEach(c =>
        tri(Z, [[c[0] * K, c[1] * K], [c[2] * K, c[3] * K], [c[4] * K, c[5] * K]], '#e9f8ff', '#9ad8f2', 1.6));
    }
  },
  meteor: {
    fill: '#8a6a58', hatch: '#5a4034', face(Z) {
      eyes(Z, { angry: 1 }); mouth(Z, 'flat');
      [[-.5, .45, 4], [.5, .5, 3], [.35, -.65, 3.2], [-.65, -.35, 2.6]].forEach(c => ring(Z, lopsided(Z, c[2], 1), c[0] * K, c[1] * K, 1.4, INK));
    }
  },
  spiegel: {
    fill: '#e8eef3', hatch: '#b8c4cf', face(Z) {
      eyes(Z, { col: '#ffffff' }); mouth(Z, 'smile');
      [[-.7, -.2, -.35, -.75], [-.55, .05, -.1, -.65]].forEach(c => line(Z, c[0] * K, c[1] * K, c[2] * K, c[3] * K, 2.6, '#ffffff', { over: .5, bow: .05 }));
    }
  },
  wuchs: {
    fill: '#bfe3a0', hatch: '#79b34f', face(Z) {
      eyes(Z, { sleepy: 1 }); mouth(Z, 'smile');
      curve(Z, [[0, -.95 * K], [.05 * K, -1.25 * K], [0, -1.5 * K]], 2.4, '#4d8a2a');
      tri(Z, [[0, -1.45 * K], [.45 * K, -1.7 * K], [.4 * K, -1.25 * K]], '#8fd06a', '#4d8a2a', 1.5);
      tri(Z, [[0, -1.3 * K], [-.45 * K, -1.55 * K], [-.4 * K, -1.1 * K]], '#8fd06a', '#4d8a2a', 1.5);
    }
  },
  drache: {
    fill: '#e8643a', hatch: '#b32a14', face(Z) {
      [-1, 1].forEach(s => tri(Z, [[s * .35 * K, -.82 * K], [s * .55 * K, -1.45 * K], [s * .7 * K, -.7 * K]], '#fff0c0', '#d6a21a'));
      [-.25, 0, .25].forEach(x => tri(Z, [[x * K - 3, -.97 * K + Math.abs(x) * 8], [x * K, -1.2 * K + Math.abs(x) * 10], [x * K + 3, -.97 * K + Math.abs(x) * 8]], '#ffd24a', null, 1.2));
      eyes(Z, { angry: 1, col: '#fff3b0', pupil: '#222', er: .16, sp: .32, dy: -.18 });
      ring(Z, lopsided(Z, K * .34, 1), 0, .38 * K, 1.8, INK, { turns: 1 });
      dot(Z, -.1 * K, .36 * K, 1.8); dot(Z, .1 * K, .36 * K, 1.8);
    }
  },
  phoenix: {
    fill: '#ffbe3a', hatch: '#e0521a', face(Z) {
      [[-.45, -.8, -.7, -1.6, -.15, -.95], [-.1, -.9, 0, -1.8, .1, -.9], [.15, -.95, .7, -1.6, .45, -.8]].forEach(c =>
        tri(Z, [[c[0] * K, c[1] * K], [c[2] * K, c[3] * K], [c[4] * K, c[5] * K]], '#ff7a1a', '#d8300a', 1.6));
      eyes(Z, { angry: 1, er: .17, dy: -.15 });
      tri(Z, [[-.12 * K, .15 * K], [.12 * K, .15 * K], [0, .5 * K]], '#ff9a2a', null, 1.6);
    }
  }
};

const bodyCache = {};
export function bodySprite(type) {
  let s = bodyCache[type];
  if (s) return s;
  const d = DEFS[type], B = BODIES[type], idx = Object.keys(DEFS).indexOf(type);
  s = mkSprite(300 + idx, 120, 120, 60, 62, Z => {
    bodyBase(Z, RC(d.rarity), B.fill, B.hatch);
    B.face(Z);
  });
  bodyCache[type] = s;
  return s;
}

/* ---------- Teile ---------- */
function once(fn) { let v; return () => v || (v = fn()); }
export const SPIKE = once(() => mkSprite(110, 26, 30, 13, 24, Z => {
  const P = [[-6.5, 2], [0, -17], [6.5, 2]];
  wash(Z, P, '#d6d6d6', 1.6); hatchPoly(Z, P, '#a8a8a8', -.9, 3.2, 1.3, {});
  line(Z, -6.5, 1, 0, -17, 2.1, INK, { over: 1.4, bow: .1 }); line(Z, 6.5, 1, 0, -17, 2.1, INK, { over: 1.4, bow: .1 });
}));
export const BARREL = once(() => mkSprite(111, 44, 22, 8, 11, Z => {
  const P = [[0, -4.5], [22, -4.5], [22, 4.5], [0, 4.5]];
  wash(Z, P, '#c4c4c4', 1.6); hatchPoly(Z, P, '#999', -.9, 3, 1.2, {});
  line(Z, 0, -4.5, 22, -4.5, 2.2, INK, { over: 1.5 }); line(Z, 0, 4.5, 22, 4.5, 2.2, INK, { over: 1.5 }); line(Z, 22, -6.5, 22, 6.5, 3, INK, { over: 1 });
}));
export const BULLET = once(() => mkSprite(112, 16, 16, 8, 8, Z => { const rf = lopsided(Z, 3.4, 1.2); wash(Z, circPoly(rf, 0, 0, 10), '#555', .8); ring(Z, rf, 0, 0, 1.8, INK); }));
export const DAGGER = once(() => mkSprite(113, 40, 22, 14, 11, Z => {
  const B = [[0, -3.6], [16, 0], [0, 3.6]];
  wash(Z, B, '#eef2f7', 1.4); line(Z, 0, -3.6, 16.5, 0, 1.9, INK, { over: 1 }); line(Z, 0, 3.6, 16.5, 0, 1.9, INK, { over: 1 }); line(Z, 0, -3.6, 0, 3.6, 1.6, INK, { over: .8 });
  line(Z, -1.2, -6.5, -1.2, 6.5, 2.8, INK, { over: 1 }); line(Z, -1.2, 0, -9.5, 0, 3.2, '#7a4a21', { over: .6 });
}));
const LEG = once(() => mkSprite(114, 34, 28, 5, 14, Z => { curve(Z, [[0, 0], [10, -8], [22, 5]], 2.4, INK); }));
export const SPARK = once(() => mkSprite(116, 18, 18, 9, 9, Z => {
  const P = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 - 1.57, rr = i % 2 ? 2.6 : 8; P.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  wash(Z, P, '#ffe066', 1); poly(Z, P, 1.5, INK, true, { over: .6, bow: .03 });
}));
export const FLAME = once(() => mkSprite(117, 28, 38, 14, 32, Z => {
  const P = [[-9, 0], [-10, -9], [-4, -16], [-5, -26], [2, -34], [4, -22], [10, -14], [10, -4], [5, 3], [-4, 3]];
  wash(Z, P, '#ff9a2a', 1.6);
  const Q = [[-5, 1], [-5, -7], [0, -14], [1, -20], [4, -10], [6, -3], [1, 2]];
  wash(Z, Q, '#ffe066', 1);
  curve(Z, P.concat([P[0], P[1]]), 1.9, INK);
}));
export const PUDDLE = once(() => mkSprite(118, 70, 70, 35, 35, Z => {
  const rf = lopsided(Z, 24, 4), P = circPoly(rf, 0, 0, 20);
  wash(Z, P, 'rgba(120,200,60,.65)', 2); hatchPoly(Z, P, '#5a9a22', -.8, 5, 1.2, {});
  ring(Z, rf, 0, 0, 1.8, INK);
  [[-8, -6, 4], [9, 5, 3], [3, -10, 2.5]].forEach(c => ring(Z, lopsided(Z, c[2], 1), c[0], c[1], 1.2, INK));
}));
export const BOOMER = once(() => mkSprite(119, 30, 30, 15, 15, Z => {
  const P = [[-10, -10], [4, -9], [-2, -2], [8, 8], [-4, 11], [-12, 0]].map(p => [p[0], p[1]]);
  wash(Z, P, '#e0b060', 1); hatchPoly(Z, P, '#a8742a', .8, 3, 1.1, {}); poly(Z, P, 1.8, INK, true, { over: .6, bow: .03 });
}));
export const BOMB = once(() => mkSprite(124, 30, 36, 15, 22, Z => {
  const rf = lopsided(Z, 9, 1), P = circPoly(rf, 0, 0, 16);
  wash(Z, P, '#4a4f5a', 1); ring(Z, rf, 0, 0, 2.2, INK); curve(Z, [[2, -9], [4, -14], [9, -16]], 2, INK);
  curve(Z, [[-5, -3], [-3, -6]], 1.6, '#fffdf6');
}));
export const ROCK = once(() => mkSprite(125, 40, 40, 20, 20, Z => {
  const P = [[-12, -3], [-6, -12], [5, -11], [12, -2], [9, 9], [-4, 12], [-11, 7]];
  wash(Z, P, '#8a6a58', 1.4); hatchPoly(Z, P, '#5a4034', -.8, 3.4, 1.2, {}); poly(Z, P, 2.2, INK, true, { over: .8, bow: .05 });
  ring(Z, lopsided(Z, 3, 1), -2, 1, 1.2, INK);
}));
export const SAWDISC = once(() => mkSprite(126, 40, 40, 20, 20, Z => {
  const P = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832, rr = i % 2 ? 11 : 17; P.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  wash(Z, P, '#d0d4d8', 1.2); hatchPoly(Z, P, '#9aa0a8', -.8, 3.4, 1.1, {}); poly(Z, P, 1.8, INK, true, { over: .5, bow: .02 });
  ring(Z, lopsided(Z, 4, 1), 0, 0, 1.5, INK);
}));
export const BEE = once(() => mkSprite(127, 28, 26, 14, 13, Z => {
  [-1, 1].forEach(s => { const P = [[0, -3], [s * 4, -11], [s * 10, -8], [s * 7, -2]]; wash(Z, P, 'rgba(230,245,255,.9)', .6); poly(Z, P, 1.2, INK, true, { over: .3, bow: .05 }); });
  const rf = lopsided(Z, 6, 1.4), P = circPoly(rf, 0, 1, 12);
  wash(Z, P, '#ffd84a', .8); line(Z, -3, -1, -3, 4, 2, INK, { over: .2 }); line(Z, 1, -2, 1, 5, 2, INK, { over: .2 }); ring(Z, rf, 0, 1, 1.6, INK);
  line(Z, 5, 1, 9, 1, 1.4, INK, { over: .2 });
}));
export const FROST = once(() => mkSprite(128, 28, 20, 14, 10, Z => {
  const P = [[-9, 0], [0, -6], [11, 0], [0, 6]];
  wash(Z, P, '#cfefff', 1); hatchPoly(Z, P, '#7cc6e8', -.8, 2.8, 1, {}); poly(Z, P, 1.8, INK, true, { over: .5, bow: .03 });
}));
export const WING = once(() => mkSprite(129, 46, 40, 4, 20, Z => {
  const P = [[0, 0], [14, -17], [26, -15], [22, -7], [34, -4], [26, 2], [30, 10], [14, 8], [4, 6]];
  wash(Z, P, '#5a4670', 1.4); hatchPoly(Z, P, '#3a2a4a', .8, 3.4, 1.1, {}); poly(Z, P, 2, INK, true, { over: .6, bow: .03 });
}));
export const WINGF = once(() => mkSprite(130, 46, 40, 4, 20, Z => {
  const P = [[0, 0], [14, -17], [26, -15], [22, -7], [34, -4], [26, 2], [30, 10], [14, 8], [4, 6]];
  wash(Z, P, '#ff8a2a', 1.4); hatchPoly(Z, P, '#d8300a', .8, 3.4, 1.1, {}); poly(Z, P, 2, INK, true, { over: .6, bow: .03 });
}));
export const ICE = once(() => mkSprite(131, 80, 80, 40, 40, Z => {
  const P = [[-34, -30], [32, -34], [36, 30], [-30, 34]];
  wash(Z, P, 'rgba(170,225,250,.55)', 2); hatchPoly(Z, P, 'rgba(255,255,255,.9)', -.7, 6, 1.6, {}); poly(Z, P, 2.4, INK, true, { over: 1.5, bow: .02 });
}));

/* ---------- Symbole ---------- */
export const HEART = once(() => mkSprite(120, 30, 28, 15, 14, Z => {
  const P = []; for (let i = 0; i < 22; i++) { const t = i / 22 * 6.2832; P.push([16 * Math.pow(Math.sin(t), 3) * 9 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 9 / 17 + .5]); }
  wash(Z, P, '#f0a0ae', 1.6); hatchPoly(Z, P, '#e0405a', -.8, 2.6, 1.3, {});
  curve(Z, P.concat([P[0], P[1], P[2]]), 2, INK);
}));
export const HEART0 = once(() => mkSprite(132, 30, 28, 15, 14, Z => {
  const P = []; for (let i = 0; i < 22; i++) { const t = i / 22 * 6.2832; P.push([16 * Math.pow(Math.sin(t), 3) * 9 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 9 / 17 + .5]); }
  curve(Z, P.concat([P[0], P[1], P[2]]), 1.6, '#9a8f80');
  line(Z, -5, -3, 5, 6, 1.6, '#9a8f80', { over: 0 });
}));
export const SWORD = once(() => mkSprite(121, 34, 34, 17, 17, Z => {
  g.save(); g.rotate(-.785);
  const B = [[-2, -2.6], [11, -2.2], [16, 0], [11, 2.2], [-2, 2.6]];
  wash(Z, B, '#e7edf4', 1.2); hatchPoly(Z, B, '#a9b4c0', .3, 2.6, 1.1, {});
  poly(Z, B, 1.8, INK, true, { over: .8 }); line(Z, -3, -6.5, -3, 6.5, 2.5, INK, { over: 1 }); line(Z, -3, 0, -10, 0, 3, '#7a4a21', { over: .5 });
  g.restore();
}));
export const COIN = once(() => mkSprite(122, 26, 26, 13, 13, Z => {
  const rf = lopsided(Z, 8.5, 1), P = circPoly(rf, 0, 0, 22);
  wash(Z, P, '#ffe58a', 1.6); hatchPoly(Z, P, '#e0a800', -.8, 2.6, 1.2, {});
  ring(Z, rf, 0, 0, 2, INK); ring(Z, lopsided(Z, 5, 1), 0, 0, 1.2, INK, { turns: .8 });
  line(Z, -1.5, -2.5, -1.5, 2.8, 1.3, INK, { over: .5 });
}));
export const STAR = once(() => mkSprite(123, 26, 26, 13, 13, Z => {
  const P = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 - 1.57, rr = i % 2 ? 4.2 : 10; P.push([Math.cos(a) * rr, Math.sin(a) * rr + .5]); }
  wash(Z, P, '#ffe066', 1.4); poly(Z, P, 1.9, INK, true, { over: 1, bow: .03 });
}));
export const CROWN = once(() => mkSprite(133, 34, 28, 17, 14, Z => {
  const P = [[-12, 8], [-13, -8], [-6, -1], [0, -11], [6, -1], [13, -8], [12, 8]];
  wash(Z, P, '#ffd24a', 1.4); hatchPoly(Z, P, '#e0a800', -.8, 3, 1.2, {}); poly(Z, P, 2, INK, true, { over: .8, bow: .03 });
}));
export const LOCK = once(() => mkSprite(134, 26, 30, 13, 15, Z => {
  curve(Z, [[-6, -3], [-6, -11], [0, -14], [6, -11], [6, -3]], 2.4, INK);
  const P = [[-9, -3], [9, -3], [9, 11], [-9, 11]]; wash(Z, P, '#ffe08a', 1.2); poly(Z, P, 2, INK, true, { over: .8 });
  dot(Z, 0, 4, 1.8);
}));
export const CHECK = once(() => mkSprite(135, 28, 24, 14, 12, Z => { curve(Z, [[-9, 0], [-3, 7], [10, -8]], 4, '#2f9a3a'); }));
export const CROSS = once(() => mkSprite(136, 24, 24, 12, 12, Z => { line(Z, -7, -7, 7, 7, 3.6, '#c93030', { over: 1 }); line(Z, 7, -7, -7, 7, 3.6, '#c93030', { over: 1 }); }));
export const ARROW = once(() => mkSprite(137, 34, 26, 17, 13, Z => { line(Z, 12, 0, -12, 0, 3.4, INK, { over: 1 }); line(Z, -12, 0, -4, -8, 3.4, INK, { over: 1 }); line(Z, -12, 0, -4, 8, 3.4, INK, { over: 1 }); }));
export const PLUS = once(() => mkSprite(138, 24, 24, 12, 12, Z => { line(Z, -8, 0, 8, 0, 3.4, INK, { over: 1 }); line(Z, 0, -8, 0, 8, 3.4, INK, { over: 1 }); }));
export const SKIP = once(() => mkSprite(139, 34, 26, 17, 13, Z => {
  const A = [[-12, -9], [-1, 0], [-12, 9]], B = [[0, -9], [11, 0], [0, 9]];
  wash(Z, A, '#ffe08a', 1); poly(Z, A, 2.2, INK, true, { over: .6 }); wash(Z, B, '#ffe08a', 1); poly(Z, B, 2.2, INK, true, { over: .6 });
}));
export const BOXART = once(() => mkSprite(140, 130, 120, 65, 70, Z => {
  const F = [[-46, -10], [46, -10], [46, 44], [-46, 44]];
  wash(Z, F, '#d9a45a', 2); hatchPoly(Z, F, '#a8742a', -.8, 5, 1.4, {}); poly(Z, F, 3, INK, true, { over: 2, bow: .02 });
  const L = [[-52, -10], [52, -10], [46, -34], [-46, -34]];
  wash(Z, L, '#e8b86a', 2); hatchPoly(Z, L, '#a8742a', .8, 5, 1.2, {}); poly(Z, L, 3, INK, true, { over: 2, bow: .02 });
  line(Z, -8, -34, -8, 44, 8, '#d33a3a', { over: 0, bow: 0 }); line(Z, 8, -34, 8, 44, 8, '#d33a3a', { over: 0, bow: 0 });
  line(Z, -6, -34, -6, 44, 2, INK, { over: 0, bow: 0 }); line(Z, 6, -34, 6, 44, 2, INK, { over: 0, bow: 0 });
  const S = []; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 - 1.57, rr = i % 2 ? 4 : 10; S.push([Math.cos(a) * rr, Math.sin(a) * rr - 52]); }
  wash(Z, S, '#ffe066', 1); poly(Z, S, 1.6, INK, true, { over: .6 });
}));

/* ---------- Bälle zusammenbauen ---------- */
function sprF(sp, x, y, f, sc, rot, alpha, flip) {
  if (!flip) { spr(sp, x, y, f, sc, rot, alpha); return; }
  g.save(); g.translate(x, y); g.scale(-1, 1); spr(sp, 0, 0, f, sc, rot ? -rot : 0, alpha); g.restore();
}
export function liveRing(x, y, r, w, col, f, seed) {
  const R = mulberry((seed | 0) * 31 + f * 77 + 5), n = Math.max(10, Math.round(r / 3));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= n + 1; i++) {
    const a = i / n * 6.2832 + R() * .05, rr = r * (1 + (R() - .5) * .035);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}
export function liveArc(x, y, r, a0, a1, w, col, f, seed) {
  const R = mulberry((seed | 0) * 17 + f * 71 + 9), n = Math.max(6, Math.round(Math.abs(a1 - a0) * r / 4));
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, rr = r + (R() - .5) * .9;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}
export function liveSeg(x1, y1, x2, y2, w, col, f, seed) {
  const R = mulberry((seed | 0) * 13 + f * 59 + 3);
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1 + (R() - .5) * .8, y1 + (R() - .5) * .8);
  g.lineTo((x1 + x2) / 2 + (R() - .5) * 1.6, (y1 + y2) / 2 + (R() - .5) * 1.6);
  g.lineTo(x2 + (R() - .5) * .8, y2 + (R() - .5) * .8); g.stroke();
}

function nearestFoe(b, sim) {
  let best = null, bd = 1e18;
  for (const e of sim.balls) {
    if (e.dead || e.team === b.team) continue;
    const d = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Zeichnet einen Ball (Koordinaten in Arena-Einheiten). tf = Zeichen-Frame, tm = Echtzeit in Sekunden
export function drawBall(b, sim, tf, tm) {
  const d = b.def, st = b.st || {}, f = tf + b.id, sc = b.r / R0, x = b.x, y = b.y, type = b.type;
  const spd = Math.hypot(b.vx, b.vy) || 1;
  /* hinten */
  if (type === 'stachel') {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * 6.2832 + tm * .5;
      spr(SPIKE(), x + Math.cos(a) * (b.r - 2), y + Math.sin(a) * (b.r - 2), f + i, sc, a + 1.5708);
    }
  } else if (type === 'turret') {
    const e = nearestFoe(b, sim);
    const a = e ? Math.atan2(e.y - y, e.x - x) : -.5 + Math.sin(tm) * .3;
    spr(BARREL(), x + Math.cos(a) * (b.r - 3), y + Math.sin(a) * (b.r - 3), f, sc, a);
  } else if (type === 'spinne') {
    const A = [2.5, 3.14, 3.8, .64, 0, -.66];
    for (let i = 0; i < 6; i++) {
      const a = A[i] + Math.sin(tm * 3 + i) * .14;
      spr(LEG(), x + Math.cos(a) * b.r * .9, y + Math.sin(a) * b.r * .9, f + i, sc, a);
    }
    if (st.th) for (let i = 0; i < st.th.length; i++) liveSeg(st.th[i].x, st.th[i].y, x, y, 1.1, 'rgba(70,62,54,.75)', tf, i + b.id * 100);
  } else if (type === 'vampir' || type === 'drache') {
    const w = 1 + Math.sin(tm * 6 + b.id) * .12;
    sprF(WING(), x + b.r * .75, y - b.r * .1, f, sc * 1.05 * w, -.4);
    sprF(WING(), x - b.r * .75, y - b.r * .1, f + 1, sc * 1.05 * w, -.4, null, true);
  } else if (type === 'phoenix') {
    const w = 1 + Math.sin(tm * 8 + b.id) * .16;
    sprF(WINGF(), x + b.r * .75, y - b.r * .1, f, sc * 1.2 * w, -.4);
    sprF(WINGF(), x - b.r * .75, y - b.r * .1, f + 1, sc * 1.2 * w, -.4, null, true);
  } else if (type === 'saege') {
    spr(SAWDISC(), x, y, f, (b.r + 6) / 17 * 1.0, tm * 2.4);
  } else if (type === 'meteor') {
    spr(FLAME(), x - b.vx / spd * b.r * 1.3, y - b.vy / spd * b.r * 1.3, f, sc * 1.1, Math.atan2(-b.vy, -b.vx) + 1.5708, .9);
  } else if (type === 'echo' && st.ghosts) {
    for (let i = 0; i < st.ghosts.length; i++) spr(bodySprite('echo'), st.ghosts[i][0], st.ghosts[i][1], f + i, sc, 0, .3 - i * .05);
  } else if (type === 'magnet' && !b.preview) {
    const ph = (tm * 70) % 190;
    liveRing(x, y, ph, 1.1, 'rgba(211,58,58,' + (0.4 * (1 - ph / 190)).toFixed(2) + ')', tf, b.id);
  }
  /* Körper */
  const sp = bodySprite(type);
  spr(sp, x, y, f, sc);
  /* vorne */
  if (type === 'feuer') {
    spr(FLAME(), x, y - b.r * .85, f, sc * (.95 + .12 * Math.sin(tm * 9)), Math.sin(tm * 5) * .1);
  } else if (type === 'schwert') {
    const n = st.n || 1, ang = st.ang || 0;
    for (let i = 0; i < n; i++) {
      const a = ang + i * 6.2832 / n;
      spr(DAGGER(), x + Math.cos(a) * (b.r + 4), y + Math.sin(a) * (b.r + 4), f + i, 1.0, a);
    }
  } else if (type === 'schmied') {
    const lv = Math.min(8, st.lv || 0);
    for (let i = 0; i < lv; i++) spr(STAR(), x + (i - (lv - 1) / 2) * 9, y - b.r - 10, f + i, .6);
  } else if (type === 'bombe') {
    spr(SPARK(), x + b.r * .38, y - b.r * 1.45, f, .5 + .15 * Math.sin(tm * 14));
  } else if (type === 'schild') {
    const a = st.ang || 0, R = b.r + 8;
    liveArc(x, y, R, a - .8, a + .8, 6, '#9fb3cf', tf, b.id);
    liveArc(x, y, R + 2.6, a - .8, a + .8, 1.8, INK, tf, b.id + 1);
    liveArc(x, y, R - 2.6, a - .8, a + .8, 1.8, INK, tf, b.id + 2);
  } else if (type === 'schwarm') {
    for (let i = 0; i < 3; i++) {
      const a = tm * 2.2 + i * 2.094;
      spr(BEE(), x + Math.cos(a) * (b.r + 11), y + Math.sin(a) * (b.r + 11) * .8, f + i, .65, 0);
    }
  } else if (type === 'drache' && st.breath > 0) {
    const ax = st.ax, ay = st.ay, a = Math.atan2(ay, ax);
    for (let i = 0; i < 9; i++) {
      const dist = b.r + 8 + i * 15, w = .45 + i * .1;
      spr(FLAME(), x + ax * dist, y + ay * dist, f + i, w * (.9 + .15 * Math.sin(tm * 14 + i)), a + 1.5708, .88);
    }
  }
  /* Zustände */
  if (b.flash > 0) {
    g.save(); g.globalAlpha = .5; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, b.r * .95, 0, 6.2832); g.fill(); g.restore();
  }
  if (b.stun > 0) {
    spr(ICE(), x, y, f, b.r * 2.3 / 70);
    for (let i = 0; i < 3; i++) { const a = tm * 4 + i * 2.094; spr(STAR(), x + Math.cos(a) * b.r * .9, y - b.r * 1.15 + Math.sin(a) * 5, f + i, .55); }
  }
  if (type === 'phoenix' && st.rage) {
    g.save(); g.globalAlpha = .18; g.fillStyle = '#ff2a00'; g.beginPath(); g.arc(x, y, b.r, 0, 6.2832); g.fill(); g.restore();
  }
  /* Legendär: funkelnde Partikel */
  if (d.rarity === 'legendaer') {
    const SR = mulberry(77 + b.id);
    for (let i = 0; i < 9; i++) {
      const ph = SR(), s2 = .4 + SR() * .6, ang = SR() * 6.2832, dist = b.r * (1.5 + SR() * .7), life = (tm * s2 + ph) % 1;
      spr(SPARK(), x + Math.cos(ang + tm * .5) * dist, y + Math.sin(ang + tm * .5) * dist - life * 16, f + i, sc * (.55 + SR() * .35), 0, Math.max(0, 1 - life));
    }
  }
}

/* Vorschau-Ball (Sammlung, Karten): ein nachgebauter Ball ohne Kampf */
export function fakeBall(type, tm, x, y, r) {
  const def = DEFS[type];
  const b = {
    id: (Object.keys(DEFS).indexOf(type) + 1) * 3, type, def, team: 0, x, y, r: r || def.r, vx: 100, vy: 30, st: {}, stun: 0, flash: 0, preview: true
  };
  const st = b.st;
  st.n = 3; st.ang = tm * 2.5; st.lv = 2; st.breath = 0; st.rage = 0; st.th = [];
  if (type === 'schild') st.ang = tm * 1.8;
  return b;
}
const fakeSim = { balls: [], objs: [], t: 0 };
// Zeichnet einen Ball mittig in einen Canvas (für Sammlung und Auswahl). size = Ausschnitt in CSS-Pixeln
export function drawBallIn(ctx, type, size, tm, tf, fit) {
  const def = DEFS[type], old = setTarget(ctx);
  T.f = tf;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const EXT = { stachel: 1.55, turret: 1.5, schwert: 1.95, spinne: 1.95, vampir: 2.05, drache: 2.1, phoenix: 2.1, schwarm: 1.75, saege: 1.45, schild: 1.45, meteor: 1.45, feuer: 1.35, magnet: 1.35, wuchs: 1.3, eis: 1.25, schmied: 1.25, bombe: 1.25, gift: 1.1, ramm: 1.2 };
  const s = (size * (fit || .5)) / (Math.max(def.r, 18) * 2 * (EXT[type] || 1.1));
  ctx.scale(s, s);
  const b = fakeBall(type, tm, 0, 0, def.r);
  fakeSim.balls = [b];
  drawBall(b, fakeSim, tf, tm);
  ctx.restore();
  setTarget(old);
}

/* ---------- Geschosse und Fallen ---------- */
export function drawObj(o, sim, tf, tm) {
  const f = tf + (o.owner || 0) * 3;
  switch (o.k) {
    case 'spike': {
      const a = Math.atan2(o.ny, o.nx) + 1.5708;
      spr(SPIKE(), o.x, o.y, f, 1, a);
      break;
    }
    case 'bullet': spr(BULLET(), o.x, o.y, f, o.r / 3.4 * .9); break;
    case 'fire': spr(FLAME(), o.x, o.y + 3, f + Math.floor(o.x), o.r / 9 * .9, Math.sin(tm * 6 + o.x) * .1, Math.min(1, o.life / .6)); break;
    case 'puddle': spr(PUDDLE(), o.x, o.y, f, o.r / 24, 0, Math.min(.9, o.life / 1.5)); break;
    case 'boom': spr(BOOMER(), o.x, o.y, f, 1, o.rot); break;
    case 'bomb': {
      const p = 1 - o.fuse / 1.8, pulse = .5 + .5 * Math.sin(tm * (10 + p * 20));
      liveRing(o.x, o.y, o.r, 1.3, 'rgba(211,58,58,' + (0.25 + 0.4 * p).toFixed(2) + ')', tf, f);
      g.save(); g.globalAlpha = .08 + .12 * pulse * p; g.fillStyle = '#d33a3a'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.2832); g.fill(); g.restore();
      spr(BOMB(), o.x, o.y + 4, f, .9 + .12 * pulse);
      break;
    }
    case 'meteor': {
      const p = 1 - Math.max(0, o.fuse) / 1;
      liveRing(o.x, o.y, o.r, 1.4, 'rgba(211,90,30,.55)', tf, f);
      liveRing(o.x, o.y, o.r * (1 - p) + 4, 1.2, 'rgba(211,90,30,.8)', tf, f + 1);
      const k = Math.max(0, o.fuse);
      if (k > 0) {
        spr(FLAME(), o.x + k * 90 - 6, o.y - k * 330 - 24, f, 1.1, 2.9, .8);
        spr(ROCK(), o.x + k * 90, o.y - k * 330, f, 1.1, tm * 3);
      }
      break;
    }
    case 'saw': spr(SAWDISC(), o.x, o.y, f, o.r / 15, o.rot); break;
    case 'bee': spr(BEE(), o.x, o.y, f, .75, Math.atan2(o.vy, o.vx)); break;
    case 'frost': spr(FROST(), o.x, o.y, f, 1, Math.atan2(o.vy, o.vx)); break;
  }
}

/* ---------- Effekte (Funken, Explosionen) ---------- */
const FXL = [];
export function addFx(e) {
  if (FXL.length > 120) return;
  const k = e.k;
  if (k === 'hit') FXL.push({ k, x: e.x, y: e.y, age: 0, life: .3, n: 4, big: Math.min(1, .5 + e.a * .02) });
  else if (k === 'boom') FXL.push({ k, x: e.x, y: e.y, age: 0, life: .5, r: e.a });
  else if (k === 'die') FXL.push({ k, x: e.x, y: e.y, age: 0, life: .9, r: e.a });
  else if (k === 'split') FXL.push({ k, x: e.x, y: e.y, age: 0, life: .4, r: e.a });
  else if (k === 'levelup') FXL.push({ k, x: e.x, y: e.y, age: 0, life: .9, r: 20 });
  else if (k === 'grab' || k === 'block') FXL.push({ k: 'hit', x: e.x, y: e.y, age: 0, life: .35, n: 3, big: .7 });
}
export function drawFx(dt, tf) {
  for (let i = FXL.length - 1; i >= 0; i--) {
    const e = FXL[i];
    e.age += dt;
    if (e.age >= e.life) { FXL.splice(i, 1); continue; }
    const p = e.age / e.life;
    if (e.k === 'hit') {
      const R = mulberry(Math.floor(e.x * 7 + e.y * 3) + 11);
      for (let j = 0; j < e.n; j++) {
        const a = R() * 6.2832, d = 6 + p * 18 * (.6 + R() * .6);
        spr(SPARK(), e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, tf + j, .5 * e.big + .2, a, 1 - p);
      }
    } else if (e.k === 'boom') {
      liveRing(e.x, e.y, e.r * (.3 + .7 * p), 3.2 * (1 - p) + .8, 'rgba(240,120,30,' + (1 - p).toFixed(2) + ')', tf, 7);
      liveRing(e.x, e.y, e.r * (.2 + .6 * p), 1.4, 'rgba(43,33,24,' + (.8 * (1 - p)).toFixed(2) + ')', tf, 8);
      const R = mulberry(Math.floor(e.x * 5 + e.y) + 3);
      for (let j = 0; j < 8; j++) { const a = R() * 6.2832, d = e.r * (.2 + .7 * p) * (.5 + R() * .5); spr(SPARK(), e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, tf + j, .7, a, 1 - p); }
    } else if (e.k === 'die') {
      const R = mulberry(Math.floor(e.x * 5 + e.y) + 21);
      for (let j = 0; j < 12; j++) { const a = R() * 6.2832, d = e.r * (.3 + 1.8 * p) * (.5 + R() * .6); spr(SPARK(), e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - p * 10, tf + j, .6 + R() * .5, a, 1 - p); }
      liveRing(e.x, e.y, e.r * (1 + 2 * p), 2.4 * (1 - p) + .5, 'rgba(43,33,24,' + (1 - p).toFixed(2) + ')', tf, 5);
    } else if (e.k === 'split') {
      liveRing(e.x, e.y, e.r * (1 + p * 1.2), 1.8, 'rgba(139,79,201,' + (1 - p).toFixed(2) + ')', tf, 4);
    } else if (e.k === 'levelup') {
      spr(STAR(), e.x, e.y - p * e.r - 8, tf, .9, 0, 1 - p * p);
    }
  }
}
export function clearFx() { FXL.length = 0; }
