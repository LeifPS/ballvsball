// Eigene Optik der Dropper für die Themen-Boxen (gleiche Elemente und gleiche Physik wie der Standard-Dropper, nur anderes Aussehen).
// Alles handgezeichnet über sketchCtx (sk). Koordinaten: Spielfeld 0..300, Kiste darüber ab y = -190.
import { INK } from './sk.js';

const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const grad = (x, stops) => { const g = x.createLinearGradient(0, -190, 0, 420); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const fillBg = (x, stops) => { x.fillStyle = grad(x, stops); x.fillRect(-20, -190, 340, 640); };
const disc = (x, sk, px, py, r, col, lw) => { x.fillStyle = col; sk.lineWidth = lw || 2.4; sk.strokeStyle = INK; sk.beginPath(); sk.arc(px, py, r, 0, 7); sk.fill(); sk.stroke(); };
const dots = (x, list, col) => { x.fillStyle = col; for (const d of list) { x.beginPath(); x.arc(d[0], d[1], d[2], 0, 7); x.fill(); } };
const star5 = (sk, px, py, r, r2) => { sk.beginPath(); for (let k = 0; k < 10; k++) { const a = -1.5708 + k * .6283, rr = k % 2 ? r2 : r; k ? sk.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : sk.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } sk.closePath(); };
const heart = (sk, px, py, r) => { sk.beginPath(); sk.moveTo(px, py + r * .9); sk.bezierCurveTo(px - r * 1.5, py - r * .1, px - r * .9, py - r * 1.2, px, py - r * .4); sk.bezierCurveTo(px + r * .9, py - r * 1.2, px + r * 1.5, py - r * .1, px, py + r * .9); sk.closePath(); };

export const SKIN = {
  weltraum: {
    bg(x, sk, f) {
      fillBg(x, ['#0b0e2b', '#1b2160', '#2e2a74']);
      x.fillStyle = 'rgba(160,90,220,.22)'; [[70, 40, 70], [240, 250, 80], [160, 150, 50]].forEach(c => { x.beginPath(); x.arc(c[0], c[1], c[2], 0, 7); x.fill(); });
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (.45 + rnd(i) * .5) + ')'; x.beginPath(); x.arc(rnd(i + 1) * 300, -180 + rnd(i + 2) * 560, .8 + rnd(i + 3) * 1.4, 0, 7); x.fill(); }
      disc(x, sk, 232, -90, 30, '#f2a35a'); x.save(); x.beginPath(); x.arc(232, -90, 30, 0, 7); x.clip(); x.fillStyle = 'rgba(190,90,40,.5)'; x.fillRect(190, -96, 90, 8); x.fillRect(190, -78, 90, 6); x.restore();
      sk.lineWidth = 3; sk.strokeStyle = INK; sk.beginPath(); sk.ellipse(232, -90, 48, 11, -.35, 0, 7); sk.stroke(); sk.lineWidth = 1.6; sk.strokeStyle = '#ffe6a8'; sk.beginPath(); sk.ellipse(232, -90, 48, 11, -.35, 0, 7); sk.stroke(); sk.strokeStyle = INK;
      disc(x, sk, 40, 210, 13, '#cfd6e8'); dots(x, [[36, 206, 3], [45, 214, 2.2]], 'rgba(120,130,160,.6)');
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#a4abc2'); dots(x, [[p[0] - p[2] * .3, p[1] - p[2] * .2, p[2] * .22], [p[0] + p[2] * .3, p[1] + p[2] * .3, p[2] * .16]], 'rgba(90,96,130,.7)'); },
    bump(x, sk, p) { sk.lineWidth = 1.8; sk.strokeStyle = 'rgba(255,140,90,.7)'; sk.beginPath(); sk.arc(p[0], p[1], p[2] + 5, 0, 7); sk.stroke(); disc(x, sk, p[0], p[1], p[2], '#ff7a5a'); x.save(); x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.clip(); x.fillStyle = 'rgba(255,230,160,.65)'; x.fillRect(p[0] - p[2], p[1] - 2, p[2] * 2, 3); x.restore(); }
  },
  kueche: {
    bg(x, sk, f) {
      x.fillStyle = '#f6f0e2'; x.fillRect(-20, -190, 340, 640);
      x.strokeStyle = 'rgba(110,150,175,.35)'; x.lineWidth = 2; for (let gx = 0; gx <= 300; gx += 34) { x.beginPath(); x.moveTo(gx, -190); x.lineTo(gx, 420); x.stroke(); } for (let gy = -190; gy <= 420; gy += 34) { x.beginPath(); x.moveTo(-20, gy); x.lineTo(320, gy); x.stroke(); }
      x.fillStyle = 'rgba(224,100,70,.12)'; for (let gx = 0; gx < 300; gx += 68) for (let gy = -190; gy < 420; gy += 68) x.fillRect(gx, gy, 34, 34);
      x.fillStyle = '#d9a441'; sk.lineWidth = 2.6; sk.strokeStyle = INK; sk.beginPath(); sk.arc(250, -100, 28, 0, 7); sk.fill(); sk.stroke(); x.fillStyle = '#b8862e'; sk.beginPath(); sk.arc(250, -100, 20, 0, 7); sk.fill(); sk.beginPath(); sk.moveTo(276, -108); sk.lineTo(318, -118); sk.lineTo(318, -106); sk.lineTo(276, -96); sk.closePath(); x.fillStyle = '#7a5a2a'; sk.fill(); sk.stroke();
      x.fillStyle = '#cfd6de'; sk.beginPath(); sk.ellipse(40, -90, 14, 20, 0, 0, 7); sk.fill(); sk.stroke(); sk.beginPath(); sk.moveTo(40, -70); sk.lineTo(40, -20); sk.stroke();
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#cfd6de'); sk.lineWidth = 1.8; sk.strokeStyle = 'rgba(255,255,255,.9)'; sk.beginPath(); sk.arc(p[0], p[1], p[2] * .6, 3.6, 4.9); sk.stroke(); sk.strokeStyle = INK; },
    bump(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#e0453a'); x.fillStyle = '#4fa03a'; sk.lineWidth = 1.8; star5(sk, p[0], p[1] - p[2] * .75, p[2] * .5, p[2] * .2); sk.fill(); sk.stroke(); dots(x, [[p[0] - p[2] * .4, p[1] - p[2] * .1, p[2] * .16]], 'rgba(255,255,255,.7)'); }
  },
  sport: {
    bg(x, sk, f) {
      fillBg(x, ['#58b85a', '#46a448', '#3b9040']);
      for (let gy = -190; gy < 420; gy += 60) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(-20, gy, 340, 30); }
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2.6; sk.lineWidth = 2.6; sk.strokeStyle = 'rgba(255,255,255,.85)';
      sk.beginPath(); sk.arc(150, 110, 44, 0, 7); sk.stroke(); sk.beginPath(); sk.moveTo(-10, 110); sk.lineTo(310, 110); sk.stroke();
      sk.beginPath(); sk.moveTo(70, 300); sk.lineTo(70, 360); sk.lineTo(230, 360); sk.lineTo(230, 300); sk.stroke(); sk.strokeStyle = INK;
      dots(x, [[150, 110, 3.5]], 'rgba(255,255,255,.85)');
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#fbfbf5'); x.fillStyle = '#2a2a36'; sk.lineWidth = 1.2; sk.beginPath(); for (let k = 0; k < 5; k++) { const a = -1.5708 + k * 1.2566; k ? sk.lineTo(p[0] + Math.cos(a) * p[2] * .5, p[1] + Math.sin(a) * p[2] * .5) : sk.moveTo(p[0] + Math.cos(a) * p[2] * .5, p[1] + Math.sin(a) * p[2] * .5); } sk.closePath(); sk.fill(); },
    bump(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#f08a2a'); sk.lineWidth = 1.6; sk.beginPath(); sk.moveTo(p[0] - p[2], p[1]); sk.lineTo(p[0] + p[2], p[1]); sk.moveTo(p[0], p[1] - p[2]); sk.lineTo(p[0], p[1] + p[2]); sk.stroke(); sk.beginPath(); sk.arc(p[0] - p[2] * 1.15, p[1], p[2] * .85, -.8, .8); sk.stroke(); sk.beginPath(); sk.arc(p[0] + p[2] * 1.15, p[1], p[2] * .85, Math.PI - .8, Math.PI + .8); sk.stroke(); }
  },
  elemente: {
    bg(x, sk, f) {
      x.fillStyle = '#efe8d8'; x.fillRect(-20, -190, 340, 640);
      [[-10, 400, 190, 'rgba(255,110,40,.85)'], [310, 400, 190, 'rgba(50,140,255,.85)'], [-10, -150, 190, 'rgba(140,100,55,.8)'], [310, -150, 190, 'rgba(210,240,255,.95)']].forEach(c => { const g = x.createRadialGradient(c[0], c[1], 0, c[0], c[1], c[2]); g.addColorStop(0, c[3]); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-20, -190, 340, 640); });
      x.strokeStyle = 'rgba(255,255,255,.8)'; sk.lineWidth = 2; sk.strokeStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 3; i++) { sk.beginPath(); sk.moveTo(210, -140 + i * 22); sk.quadraticCurveTo(250, -160 + i * 22, 290, -140 + i * 22); sk.stroke(); }
      x.fillStyle = '#ff9a3a'; sk.strokeStyle = INK; sk.lineWidth = 2.4; sk.beginPath(); sk.moveTo(20, 395); sk.quadraticCurveTo(10, 350, 30, 330); sk.quadraticCurveTo(32, 355, 44, 348); sk.quadraticCurveTo(58, 370, 48, 395); sk.closePath(); sk.fill(); sk.stroke();
      x.fillStyle = '#4aa8ff'; sk.beginPath(); sk.moveTo(264, 340); sk.quadraticCurveTo(250, 372, 262, 392); sk.quadraticCurveTo(284, 392, 280, 366); sk.quadraticCurveTo(278, 352, 264, 340); sk.fill(); sk.stroke();
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#a89880'); dots(x, [[p[0] - p[2] * .3, p[1] - p[2] * .25, p[2] * .2], [p[0] + p[2] * .3, p[1] + p[2] * .25, p[2] * .15]], 'rgba(100,85,65,.6)'); },
    bump(x, sk, p) { x.fillStyle = '#ff7a2a'; sk.lineWidth = 2.4; sk.strokeStyle = INK; sk.beginPath(); sk.moveTo(p[0] - p[2], p[1] + p[2]); sk.quadraticCurveTo(p[0] - p[2] * 1.3, p[1] - p[2] * .3, p[0] - p[2] * .1, p[1] - p[2] * 1.5); sk.quadraticCurveTo(p[0] + p[2] * .1, p[1] - p[2] * .3, p[0] + p[2] * .5, p[1] - p[2] * .6); sk.quadraticCurveTo(p[0] + p[2] * 1.4, p[1], p[0] + p[2], p[1] + p[2]); sk.closePath(); sk.fill(); sk.stroke(); x.fillStyle = '#ffd24a'; sk.beginPath(); sk.ellipse(p[0], p[1] + p[2] * .35, p[2] * .4, p[2] * .5, 0, 0, 7); sk.fill(); }
  },
  ozean: {
    bg(x, sk, f) {
      fillBg(x, ['#9be8ff', '#3aa0d8', '#1c5fa0']);
      x.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(40 + i * 70, -190); x.lineTo(70 + i * 70, -190); x.lineTo(110 + i * 70 - 30, 420); x.lineTo(60 + i * 70 - 30, 420); x.closePath(); x.fill(); }
      sk.lineWidth = 1.6; sk.strokeStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 12; i++) { sk.beginPath(); sk.arc(rnd(i) * 300, -150 + rnd(i + 5) * 480, 3 + rnd(i + 9) * 6, 0, 7); sk.stroke(); }
      sk.strokeStyle = '#1f7a4a'; sk.lineWidth = 6; for (const bx of [14, 50, 262, 288]) { sk.beginPath(); sk.moveTo(bx, 440); sk.quadraticCurveTo(bx + 14, 400, bx - 6, 370); sk.quadraticCurveTo(bx - 18, 340, bx + 4, 316); sk.stroke(); }
      sk.strokeStyle = INK; disc(x, sk, 244, -92, 26, '#ffd45a'); x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(238, -100, 8, 0, 7); x.fill();
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#f6e4cc'); sk.lineWidth = 1.4; sk.strokeStyle = 'rgba(190,140,100,.9)'; for (let k = -2; k <= 2; k++) { sk.beginPath(); sk.moveTo(p[0] + k * p[2] * .25, p[1] + p[2] * .85); sk.lineTo(p[0] + k * p[2] * .4, p[1] - p[2] * .8); sk.stroke(); } sk.strokeStyle = INK; },
    bump(x, sk, p) { x.fillStyle = '#ff8a4a'; sk.lineWidth = 2.4; sk.strokeStyle = INK; star5(sk, p[0], p[1], p[2] * 1.25, p[2] * .6); sk.fill(); sk.stroke(); dots(x, [[p[0], p[1], p[2] * .2]], '#ffe0a0'); }
  },
  suess: {
    bg(x, sk, f) {
      fillBg(x, ['#ffe3f0', '#ffd0e6', '#ffc0dc']);
      const cols = ['#ff5a8a', '#4fa3e8', '#ffd45a', '#7bd36a', '#a77ae8']; x.lineCap = 'round'; x.lineWidth = 3.4;
      for (let i = 0; i < 70; i++) { x.strokeStyle = cols[i % 5]; const px = rnd(i) * 300, py = -180 + rnd(i + 7) * 580, a = rnd(i + 3) * 3.14; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7); x.stroke(); }
      disc(x, sk, 236, -90, 30, '#fff'); sk.lineWidth = 5; sk.strokeStyle = '#ff5a8a'; sk.beginPath(); for (let k = 0; k <= 30; k++) { const a = k * .5, r = 2 + k * .9; k ? sk.lineTo(236 + Math.cos(a) * r, -90 + Math.sin(a) * r) : sk.moveTo(236, -90); } sk.stroke(); sk.strokeStyle = INK; sk.lineWidth = 4; sk.beginPath(); sk.moveTo(236, -60); sk.lineTo(236, 10); sk.stroke();
    },
    peg(x, sk, p, i) { disc(x, sk, p[0], p[1], p[2], ['#ff6aa0', '#5fb6ff', '#ffd45a', '#7bd36a', '#b38aef'][(i || 0) % 5]); dots(x, [[p[0] - p[2] * .35, p[1] - p[2] * .35, p[2] * .22]], 'rgba(255,255,255,.75)'); },
    bump(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#fff'); sk.lineWidth = 3.4; sk.strokeStyle = '#e0453a'; for (let k = 0; k < 4; k++) { const a = k * 1.5708 + .4; sk.beginPath(); sk.moveTo(p[0], p[1]); sk.quadraticCurveTo(p[0] + Math.cos(a + .6) * p[2] * .8, p[1] + Math.sin(a + .6) * p[2] * .8, p[0] + Math.cos(a + 1) * p[2] * .95, p[1] + Math.sin(a + 1) * p[2] * .95); sk.stroke(); } sk.strokeStyle = INK; }
  },
  familie: {
    bg(x, sk, f) {
      x.fillStyle = '#ffeacc'; x.fillRect(-20, -190, 340, 640); x.fillStyle = 'rgba(232,114,90,.12)'; for (let gx = 0; gx < 320; gx += 40) x.fillRect(gx, -190, 20, 640);
      x.fillStyle = 'rgba(232,114,90,.35)'; for (let i = 0; i < 18; i++) { const hx = 20 + (i % 5) * 62 + (Math.floor(i / 5) % 2) * 30, hy = -150 + Math.floor(i / 5) * 120 + (i % 2) * 20; heart(x, hx, hy, 7); x.fill(); }
      x.fillStyle = '#f4d2a0'; sk.lineWidth = 2.6; sk.strokeStyle = INK; sk.beginPath(); sk.rect(200, -130, 72, 58); sk.fill(); sk.stroke(); x.fillStyle = '#bfe4ff'; sk.beginPath(); sk.rect(208, -122, 56, 42); sk.fill(); sk.stroke(); sk.beginPath(); sk.moveTo(236, -122); sk.lineTo(236, -80); sk.moveTo(208, -101); sk.lineTo(264, -101); sk.stroke();
      x.fillStyle = '#e8725a'; heart(sk, 40, -110, 16); sk.fill(); sk.stroke();
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#f1e2c0'); dots(x, [[p[0] - p[2] * .3, p[1] - p[2] * .3, p[2] * .13], [p[0] + p[2] * .3, p[1] - p[2] * .3, p[2] * .13], [p[0] - p[2] * .3, p[1] + p[2] * .3, p[2] * .13], [p[0] + p[2] * .3, p[1] + p[2] * .3, p[2] * .13]], '#7a5a3a'); },
    bump(x, sk, p) { x.fillStyle = '#e0453a'; sk.lineWidth = 2.4; sk.strokeStyle = INK; heart(sk, p[0], p[1] - p[2] * .1, p[2] * 1.15); sk.fill(); sk.stroke(); dots(x, [[p[0] - p[2] * .4, p[1] - p[2] * .4, p[2] * .16]], 'rgba(255,255,255,.7)'); }
  },
  gefuehl: {
    bg(x, sk, f) {
      fillBg(x, ['#ffd6e8', '#fff1c4', '#d4f5dc', '#cfe6ff']);
      const faces = [[60, -100, 26, 0], [236, -60, 22, 1], [40, 150, 20, 2], [258, 250, 22, 3], [150, 30, 18, 1]];
      for (const [fx, fy, r, k] of faces) {
        x.fillStyle = ['#fff3a0', '#ffb0b0', '#b8d8ff', '#ffd0f0'][k]; sk.lineWidth = 2.2; sk.strokeStyle = 'rgba(29,39,66,.55)'; sk.beginPath(); sk.arc(fx, fy, r, 0, 7); sk.fill(); sk.stroke();
        x.fillStyle = 'rgba(29,39,66,.6)'; x.beginPath(); x.arc(fx - r * .35, fy - r * .15, r * .1, 0, 7); x.arc(fx + r * .35, fy - r * .15, r * .1, 0, 7); x.fill();
        sk.lineWidth = 2; sk.beginPath(); if (k === 0 || k === 3) sk.arc(fx, fy + r * .05, r * .45, .25, 2.9); else if (k === 1) sk.arc(fx, fy + r * .7, r * .4, 3.5, 5.9); else { sk.moveTo(fx - r * .3, fy + r * .35); sk.lineTo(fx + r * .3, fy + r * .35); } sk.stroke();
      }
      x.fillStyle = 'rgba(232,90,140,.4)'; [[110, -150], [200, 40], [30, 300], [270, 120], [100, 250]].forEach(c => { heart(x, c[0], c[1], 8); x.fill(); });
      sk.strokeStyle = INK;
    },
    peg(x, sk, p, i) { disc(x, sk, p[0], p[1], p[2], ['#fff3a0', '#ffc9d6', '#c8e4ff', '#d8f5c8'][(i || 0) % 4]); dots(x, [[p[0] - p[2] * .32, p[1] - p[2] * .15, p[2] * .13], [p[0] + p[2] * .32, p[1] - p[2] * .15, p[2] * .13]], INK); sk.lineWidth = 1.6; sk.strokeStyle = INK; sk.beginPath(); sk.arc(p[0], p[1] + p[2] * .05, p[2] * .45, .3, 2.84); sk.stroke(); },
    bump(x, sk, p) { x.fillStyle = '#ff6a8a'; sk.lineWidth = 2.4; sk.strokeStyle = INK; heart(sk, p[0], p[1] - p[2] * .1, p[2] * 1.15); sk.fill(); sk.stroke(); dots(x, [[p[0] - p[2] * .4, p[1] - p[2] * .4, p[2] * .16]], 'rgba(255,255,255,.75)'); }
  },
  dino: {
    bg(x, sk, f) {
      fillBg(x, ['#cfe9a0', '#8fc45a', '#5f9a40']);
      x.fillStyle = '#6a5a52'; sk.lineWidth = 2.8; sk.strokeStyle = INK; sk.beginPath(); sk.moveTo(150, 10); sk.lineTo(190, -110); sk.lineTo(230, -110); sk.lineTo(290, 10); sk.closePath(); sk.fill(); sk.stroke();
      x.fillStyle = '#ff7a2a'; sk.beginPath(); sk.moveTo(190, -110); sk.quadraticCurveTo(210, -92, 230, -110); sk.quadraticCurveTo(210, -134, 190, -110); sk.fill(); sk.stroke();
      x.fillStyle = 'rgba(255,255,255,.6)'; [[204, -140, 10], [216, -162, 13], [200, -186, 11]].forEach(c => { x.beginPath(); x.arc(c[0], c[1], c[2], 0, 7); x.fill(); });
      sk.strokeStyle = '#2f6a2a'; sk.lineWidth = 3.4; for (const [fx, fy, d] of [[6, 300, 1], [294, 290, -1], [8, 60, 1]]) for (let k = 0; k < 5; k++) { sk.beginPath(); sk.moveTo(fx, fy); sk.quadraticCurveTo(fx + d * 24, fy - 18 - k * 8, fx + d * (40 + k * 4), fy - 6 - k * 22); sk.stroke(); }
      sk.strokeStyle = 'rgba(80,60,40,.45)'; sk.lineWidth = 2; for (const [px, py] of [[120, 330], [150, 350], [176, 312]]) { sk.beginPath(); sk.moveTo(px, py); sk.lineTo(px - 5, py - 12); sk.moveTo(px, py); sk.lineTo(px, py - 14); sk.moveTo(px, py); sk.lineTo(px + 5, py - 12); sk.stroke(); } sk.strokeStyle = INK;
    },
    peg(x, sk, p) { disc(x, sk, p[0], p[1], p[2], '#9aa088'); dots(x, [[p[0] - p[2] * .3, p[1] - p[2] * .2, p[2] * .2], [p[0] + p[2] * .3, p[1] + p[2] * .3, p[2] * .15]], 'rgba(70,80,60,.6)'); },
    bump(x, sk, p) { x.fillStyle = '#f6efd0'; sk.lineWidth = 2.4; sk.strokeStyle = INK; sk.beginPath(); sk.ellipse(p[0], p[1], p[2] * .9, p[2] * 1.15, 0, 0, 7); sk.fill(); sk.stroke(); dots(x, [[p[0] - p[2] * .3, p[1] - p[2] * .3, p[2] * .2], [p[0] + p[2] * .3, p[1] + p[2] * .1, p[2] * .24], [p[0] - p[2] * .1, p[1] + p[2] * .55, p[2] * .16]], '#6aa84f'); }
  }
};
