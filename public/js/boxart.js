// Animierte Ballboxen im Tonlinge-Stil: jede Box ist eine echte Kiste mit Deckel, der ab und zu aufspringt.
// Gezeichnet wird live mit sketchCtx (wackelige Kontur), die drei Zeichen-Frames wechseln wie bei den Bällen.
import { INK, DPR, sketchCtx, strSeed } from './sk.js';

const THEMES = {
  standard: { body: '#d9a441', lid: '#f0c060', glow: '#ffe27a' },
  weltraum: { body: '#3d4aa8', lid: '#5b6ad0', glow: '#9fe8ff' },
  kueche: { body: '#e0714f', lid: '#c85a3a', glow: '#ffd59a' },
  sport: { body: '#4fae6a', lid: '#7ad08e', glow: '#d5ffb0' },
  elemente: { body: '#5aa7de', lid: '#eaf5ff', glow: '#fff2a0' },
  ozean: { body: '#2f9fcf', lid: '#6fd0ee', glow: '#c8f4ff' },
  suess: { body: '#e85fa5', lid: '#ffd0e6', glow: '#fff2a0' },
  familie: { body: '#e8725a', lid: '#ffd9a8', glow: '#ffe6a8' },
  halloween: { body: '#f58a1f', lid: '#d96e0c', glow: '#ffe14a' }
};
const hashId = id => [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0);

function star4(c, x, y, r, col) {
  c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
  c.fillStyle = col; c.fill();
}
const FS = (c, col) => { c.fillStyle = col; c.fill(); c.stroke(); };

// Dekor auf der Vorderseite (Koordinaten absolut, Körper x 20..80, y 50..88)
const BODY = {
  standard(c, t) {
    c.lineWidth = 2; c.strokeStyle = '#a87a2a'; c.beginPath(); c.moveTo(20, 63); c.lineTo(80, 63); c.moveTo(20, 76); c.lineTo(80, 76); c.stroke();
    c.lineWidth = 3; c.strokeStyle = INK;
    c.beginPath(); c.rect(45, 50, 10, 38); FS(c, '#e0533a');
    for (const x of [20, 74]) for (const y of [50, 82]) { c.beginPath(); c.rect(x, y, 6, 6); FS(c, '#b9c0cc'); }
  },
  weltraum(c, t) {
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) { const x = 25 + (i * 37) % 50, y = 55 + (i * 23) % 30; c.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 3 + i * 1.7)); star4(c, x, y, 2.6, '#fff'); }
    c.globalAlpha = 1;
    c.beginPath(); c.arc(50, 70, 9, 0, 7); FS(c, '#f4c942');
    c.beginPath(); c.ellipse(50, 70, 17, 4.5, -.35, 0, 7); c.lineWidth = 2.6; c.stroke();
  },
  kueche(c, t) {
    c.lineWidth = 2;
    for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.rect(20 + i * 6, 76 + j * 6, 6, 6); c.fillStyle = (i + j) % 2 ? '#fff4d6' : '#e0714f'; c.fill(); c.stroke(); }
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(50, 61, 5, 6, 0, 0, 7); FS(c, '#fff4d6');   // Löffel
    c.beginPath(); c.rect(48.5, 66, 3, 8); FS(c, '#fff4d6');
  },
  sport(c, t) {
    c.lineWidth = 3;
    [[27, '#e0533a'], [44, '#ffd45a'], [61, '#4fa3e8']].forEach((p, i) => {
      c.beginPath(); c.rect(p[0], 62 + Math.sin(t * 3 + i) * 1.2, 13, 13); FS(c, p[1]);
      c.beginPath(); c.arc(p[0] + 6.5, 68.5 + Math.sin(t * 3 + i) * 1.2, 2.2, 0, 7); c.fillStyle = '#fff'; c.fill();
    });
  },
  elemente(c, t) {
    c.lineWidth = 2; c.strokeStyle = '#2f7fb8';
    for (let i = 0; i < 5; i++) { const y = 54 + ((t * 26 + i * 9) % 34); c.beginPath(); c.moveTo(25 + i * 12, y); c.lineTo(23 + i * 12, y + 5); c.stroke(); }
    c.lineWidth = 3; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(54, 54); c.lineTo(40, 71); c.lineTo(49, 71); c.lineTo(44, 86); c.lineTo(63, 65); c.lineTo(53, 65); c.closePath(); FS(c, '#ffe14a');
  },
  ozean(c, t) {
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.7)';
    for (let j = 0; j < 3; j++) { c.beginPath(); for (let i = 0; i <= 12; i++) { const x = 20 + i * 5, y = 60 + j * 11 + Math.sin(i * .9 + t * 2.2 + j) * 2; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    c.lineWidth = 3; c.strokeStyle = INK;
    c.beginPath(); c.arc(50, 61, 3.2, 0, 7); FS(c, '#ffe27a'); c.beginPath(); c.moveTo(50, 64); c.lineTo(50, 82); c.moveTo(42, 69); c.lineTo(58, 69); c.stroke();
    c.beginPath(); c.moveTo(40, 76); c.quadraticCurveTo(50, 90, 60, 76); c.stroke();
    for (let i = 0; i < 3; i++) { const ph = (t * .5 + i * .33) % 1; c.globalAlpha = 1 - ph; c.beginPath(); c.arc(28 + i * 22, 86 - ph * 34, 2.4 + i * .5, 0, 7); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); c.lineWidth = 1.6; c.stroke(); }
    c.globalAlpha = 1;
  },
  suess(c, t) {
    c.lineWidth = 0; c.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(20 + i * 14, 88); c.lineTo(28 + i * 14, 88); c.lineTo(48 + i * 14, 50); c.lineTo(40 + i * 14, 50); c.closePath(); c.save(); c.beginPath(); c.rect(20, 50, 60, 38); c.clip(); c.beginPath(); c.moveTo(20 + i * 14, 88); c.lineTo(28 + i * 14, 88); c.lineTo(48 + i * 14, 50); c.lineTo(40 + i * 14, 50); c.closePath(); c.fill(); c.restore(); }
    c.lineWidth = 3; c.strokeStyle = INK;
    c.beginPath(); c.arc(50, 69, 10, 0, 7); FS(c, '#fff');
    c.lineWidth = 2.4; c.strokeStyle = '#e85fa5'; c.beginPath(); for (let i = 0; i < 24; i++) { const a = i * .5 + t * 1.5, q = 1.2 + i * .33; c[i ? 'lineTo' : 'moveTo'](50 + Math.cos(a) * q, 69 + Math.sin(a) * q); } c.stroke(); c.strokeStyle = INK;
  },
  familie(c, t) {
    const pulse = 1 + Math.sin(t * 4) * .06;
    c.lineWidth = 3; c.beginPath(); c.moveTo(50, 84); c.bezierCurveTo(26, 68, 31 * pulse, 52, 42, 55); c.bezierCurveTo(46, 56, 50, 60, 50, 63); c.bezierCurveTo(50, 60, 54, 56, 58, 55); c.bezierCurveTo(69 - (pulse - 1) * 20, 52, 74, 68, 50, 84); c.closePath(); FS(c, '#fff0d8');
    c.fillStyle = 'rgba(255,240,216,.8)'; c.lineWidth = 0;
    [[27, 80], [73, 80], [24, 62], [76, 62]].forEach((p, i) => { c.save(); c.translate(p[0], p[1] + Math.sin(t * 3 + i) * 1); c.beginPath(); c.ellipse(0, 0, 2.6, 2.2, 0, 0, 7); c.fill(); [[-3.6, -3.4], [-1.2, -4.6], [1.2, -4.6], [3.6, -3.4]].forEach(q => { c.beginPath(); c.arc(q[0], q[1], 1, 0, 7); c.fill(); }); c.restore(); });
  },
  halloween(c, t) {
    c.lineWidth = 2; c.strokeStyle = '#b4560c';
    c.beginPath(); c.moveTo(38, 50); c.quadraticCurveTo(30, 69, 38, 88); c.moveTo(62, 50); c.quadraticCurveTo(70, 69, 62, 88); c.stroke();
    c.lineWidth = 3; c.strokeStyle = INK;
    const fl = .75 + .25 * Math.sin(t * 9) * Math.sin(t * 5.3), col = 'rgba(255,225,70,' + fl + ')';
    c.beginPath(); c.moveTo(29, 66); c.lineTo(41, 66); c.lineTo(35, 56); c.closePath(); FS(c, col);
    c.beginPath(); c.moveTo(59, 66); c.lineTo(71, 66); c.lineTo(65, 56); c.closePath(); FS(c, col);
    c.beginPath(); c.moveTo(30, 74); c.lineTo(36, 80); c.lineTo(43, 75); c.lineTo(50, 81); c.lineTo(57, 75); c.lineTo(64, 80); c.lineTo(70, 74); c.lineTo(66, 85); c.lineTo(34, 85); c.closePath(); FS(c, col);
  }
};

// Dekor am Deckel (Koordinaten lokal: x 0..70, y -16..0, Scharnier links unten)
const LID = {
  standard(c, t) {
    c.lineWidth = 3; c.beginPath(); c.rect(30, -16, 10, 16); FS(c, '#e0533a');
    c.beginPath(); c.moveTo(35, -16); c.quadraticCurveTo(20, -32, 24, -19); c.quadraticCurveTo(28, -15, 35, -16); c.quadraticCurveTo(50, -32, 46, -19); c.quadraticCurveTo(42, -15, 35, -16); FS(c, '#e0533a');
  },
  weltraum(c, t) {
    c.lineWidth = 3; c.beginPath(); c.moveTo(52, -16); c.lineTo(52, -27); c.stroke();
    c.beginPath(); c.arc(52, -29, 3, 0, 7); FS(c, Math.sin(t * 6) > 0 ? '#ff5a5a' : '#8a2a2a');
    for (const x of [8, 62]) { c.beginPath(); c.arc(x, -8, 1.8, 0, 7); c.fillStyle = '#cfd6ff'; c.fill(); }
    c.beginPath(); c.ellipse(20, -8, 8, 3.5, 0, 0, 7); c.fillStyle = 'rgba(180,230,255,.8)'; c.fill(); c.lineWidth = 2; c.stroke();
  },
  kueche(c, t) {
    c.lineWidth = 3; c.beginPath(); c.rect(33, -20, 4, 5); FS(c, '#3a2a24'); c.beginPath(); c.ellipse(35, -23, 6, 4.5, 0, 0, 7); FS(c, '#3a2a24');
    c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 3; i++) {
      const ph = (t * .6 + i / 3) % 1, x = 18 + i * 17 + Math.sin(ph * 6 + i) * 3, y = -24 - ph * 22;
      c.globalAlpha = (1 - ph) * .9; c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x - 5, y + 3, x, y); c.quadraticCurveTo(x + 5, y - 3, x, y - 7); c.stroke();
    }
    c.globalAlpha = 1; c.strokeStyle = INK;
  },
  sport(c, t) {
    c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + Math.sin(t * 2) * .12, r = i % 2 ? 4 : 9; c[i ? 'lineTo' : 'moveTo'](35 + Math.cos(a) * r, -8 + Math.sin(a) * r); } c.closePath(); FS(c, '#ffd45a');
  },
  elemente(c, t) {
    // Wolke als Deckel
    c.lineWidth = 3;
    const bump = (x, r, y) => { c.beginPath(); c.arc(x, y, r, 0, 7); FS(c, '#f4faff'); };
    bump(12, 8, -8); bump(28, 11, -14); bump(46, 12, -13); bump(60, 8, -8);
    c.beginPath(); c.rect(4, -9, 64, 9); c.fillStyle = '#f4faff'; c.fill(); c.beginPath(); c.moveTo(4, 0); c.lineTo(68, 0); c.stroke();
    c.fillStyle = '#6cc4ee'; c.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { const ph = (t * 1.2 + i / 3) % 1; c.globalAlpha = 1 - ph * .7; c.beginPath(); c.moveTo(18 + i * 18, 4 + ph * 20); c.quadraticCurveTo(21 + i * 18, 9 + ph * 20, 18 + i * 18, 11 + ph * 20); c.quadraticCurveTo(15 + i * 18, 9 + ph * 20, 18 + i * 18, 4 + ph * 20); c.fill(); }
    c.globalAlpha = 1;
  },
  ozean(c, t) {
    c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + Math.sin(t * 1.5) * .1, r = i % 2 ? 5 : 12; c[i ? 'lineTo' : 'moveTo'](35 + Math.cos(a) * r, -9 + Math.sin(a) * r); } c.closePath(); FS(c, '#ff9a5a');
    c.beginPath(); c.arc(10, -6, 3, 0, 7); FS(c, '#fff'); c.beginPath(); c.arc(60, -6, 3, 0, 7); FS(c, '#fff');
  },
  suess(c, t) {
    c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); for (let i = 0; i < 7; i++) c.quadraticCurveTo(i * 10 + 5, 9 + (i % 2) * 4, (i + 1) * 10, 0); c.closePath(); FS(c, '#ff8ac0');
    c.beginPath(); c.arc(35, -19, 6, 0, 7); FS(c, '#e0453a'); c.lineWidth = 2; c.beginPath(); c.moveTo(35, -25); c.quadraticCurveTo(38, -31, 43, -31); c.stroke();
  },
  familie(c, t) {
    c.lineWidth = 3; c.beginPath(); c.moveTo(14, -16); c.lineTo(35, -34); c.lineTo(56, -16); c.closePath(); FS(c, '#c8503a');
    c.beginPath(); c.rect(41, -32, 6, 10); FS(c, '#8a5a3a');
    c.beginPath(); c.rect(29, -12, 12, 12); FS(c, '#fff0d8'); c.fillStyle = '#ffd45a'; c.fillRect(31, -10, 8, 8);
  },
  halloween(c, t) {
    c.lineWidth = 3; c.beginPath(); c.moveTo(33, -16); c.quadraticCurveTo(33, -26, 39, -29); c.lineTo(42, -26); c.quadraticCurveTo(38, -24, 38, -16); c.closePath(); FS(c, '#5cae4a');
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(40, -27); c.quadraticCurveTo(48, -32, 47, -24); c.stroke();
  }
};

// Fledermaus um die Halloween-Box, Funken und Glanz beim Öffnen
function bat(c, x, y, t) {
  const fl = Math.sin(t * 16) * .8;
  c.lineWidth = 2.4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 7, y - 7 - fl * 5, x - 13, y - 1); c.quadraticCurveTo(x - 9, y + 1, x - 6, y + 3); c.quadraticCurveTo(x - 3, y + 1, x, y + 4);
  c.quadraticCurveTo(x + 3, y + 1, x + 6, y + 3); c.quadraticCurveTo(x + 9, y + 1, x + 13, y - 1); c.quadraticCurveTo(x + 7, y - 7 - fl * 5, x, y); c.closePath(); FS(c, '#4a3566');
}

export function drawBoxArt(g, id, t, size, opts) {
  const th = THEMES[id] || THEMES.standard, T = t + hashId(id) * .37;
  const frame = Math.floor(T * 7) % 3;
  const forced = opts && opts.open != null;   // Ausschüttanimation: Deckel fest offen, kein Wackeln, kein Lichtkegel
  g.save(); g.scale(size / 100, size / 100);
  g.translate(50, 96); g.scale(1.04, 1.04); g.translate(-50, -96);
  g.lineJoin = g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
  const c = sketchCtx(g, strSeed('bx' + id) + frame * 1.713, 22); c.lineWidth = 3;
  // Rhythmus: kurzes Wackeln, dann springt der Deckel auf
  const cyc = (T % 3.8) / 3.8, wob = cyc > .42 && cyc < .55 ? Math.sin((cyc - .42) * 120) * (1 - (cyc - .42) / .13) : 0;
  const x0 = (cyc - .55) / .27, open = forced ? opts.open : x0 > 0 && x0 < 1 ? Math.sin(Math.pow(x0, .7) * Math.PI) : 0;
  const bob = forced ? 0 : Math.sin(T * 2.2) * 1.4, sq = 1 - (forced ? 0 : open) * .04;
  // Schatten
  if (!forced) { g.fillStyle = 'rgba(29,39,66,.22)'; g.beginPath(); g.ellipse(50, 92, 30 - bob, 4, 0, 0, 7); g.fill(); }
  g.translate(50, 88); g.rotate((forced ? 0 : wob) * .04); g.scale(1 / sq, sq); g.translate(-50, -88 + bob * .5);
  // Glanz aus der Kiste
  if (open > 0 && !forced) {
    const gr = g.createLinearGradient(0, 50, 0, 12); gr.addColorStop(0, th.glow); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = open * .9; g.fillStyle = gr; g.beginPath(); g.moveTo(24, 52); g.lineTo(76, 52); g.lineTo(92, 12); g.lineTo(8, 12); g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  if (id === 'sport' && open > .05 && !forced) {   // Ball hüpft heraus
    const by = 46 - open * 22 - Math.abs(Math.sin(T * 7)) * 6;
    c.lineWidth = 3; c.beginPath(); c.arc(62, by, 8, 0, 7); FS(c, '#fff'); c.beginPath(); c.moveTo(54.5, by - 2); c.quadraticCurveTo(62, by + 3, 69.5, by - 2); c.stroke();
  }
  // Körper
  c.beginPath(); c.rect(20, 50, 60, 38); FS(c, th.body);
  (BODY[id] || BODY.standard)(c, T);
  // Deckel
  g.save(); g.translate(15, 52 - open * 5); g.rotate(-open * (forced ? .9 : .42));
  c.beginPath(); c.rect(0, -16, 70, 16); FS(c, th.lid);
  (LID[id] || LID.standard)(c, T);
  g.restore();
  if (id === 'halloween') bat(c, 50 + Math.cos(T * 1.3) * 38, 22 + Math.sin(T * 2.6) * 6, T);
  // Funken beim Öffnen
  if (open > .05 && !forced) for (let i = 0; i < 5; i++) { const ph = (T * 1.4 + i * .21) % 1, x = 28 + i * 11 + Math.sin(T * 5 + i) * 3, y = 48 - ph * 36; g.globalAlpha = open * (1 - ph); star4(c, x, y, 3 + (i % 2) * 1.6, i % 2 ? '#fff' : th.glow); }
  g.globalAlpha = 1;
  g.restore();
}

/* ---------- Canvas-Verwaltung: alle sichtbaren .boxart-Canvases werden animiert ---------- */
let running = false;
export function boxArt(id, size) {
  if (!running) { running = true; requestAnimationFrame(tick); }
  return '<canvas class="boxart" data-box="' + id + '" data-size="' + size + '" style="width:' + size + 'px;height:' + size + 'px"></canvas>';
}
function tick(ms) {
  requestAnimationFrame(tick);
  for (const cv of document.querySelectorAll('canvas.boxart')) {
    const s = +cv.dataset.size || 100;
    if (cv.width !== Math.round(s * DPR)) { cv.width = Math.round(s * DPR); cv.height = Math.round(s * DPR); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.scale(DPR, DPR);
    drawBoxArt(g, cv.dataset.box, ms / 1000, s);
  }
}
