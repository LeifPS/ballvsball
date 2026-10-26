// Arena und Ballbox-Minispiel zeichnen.
import { BOX } from './engine.js';
import { SEGS, PEGS, SPINNERS, BW, BH, BR, EXIT_Y } from './boxsim.js';
import { DEFS, RARITY } from './engine.js';
import { INK, DPR, mkSprite, sketchCtx, strSeed } from './sk.js';
import { bodySprite, drawBall, drawObj, drawFx, addFx, drawHpBar, ringJ, star, fxState, GROUND } from './art.js';
import { R0 } from './ballart.js';
import { drawBoxArt } from './boxart.js';

export const TEAM_COL = ['#2b6fd0', '#d33a3a'];

/* ---------- Arena ---------- */
const AR = new Map();
function arenaSprite(AS) {
  AS = Math.round(AS);
  let sp = AR.get(AS);
  if (sp) return sp;
  const pad = 14, side = AS + pad * 2, fr = [], sc = Math.min(2, DPR);
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(side * sc);
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(pad, pad);
    x.lineJoin = x.lineCap = 'round';
    // Boden
    const sk = sketchCtx(x, 3.3 + f * 1.7, AS * .35); x.strokeStyle = INK; x.lineWidth = 4; sk.lineWidth = 4;
    x.fillStyle = '#efe3bf'; x.fillRect(0, 0, AS, AS);
    // Papierkörnung und Tupfen (fest, nur leicht verschoben)
    let seed = 99; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(160,125,60,' + (.06 + R() * .1) + ')'; const rr = 1 + R() * 2.4; x.beginPath(); x.arc(R() * AS, R() * AS, rr, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(29,39,66,.14)'; x.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) { const px = R() * (AS - 30) + 15, py = R() * (AS - 30) + 15; x.beginPath(); x.moveTo(px - 4, py + 2); x.lineTo(px, py - 5); x.lineTo(px + 4, py + 2); x.stroke(); }
    // Mittellinie
    x.setLineDash([8, 10]); x.strokeStyle = 'rgba(29,39,66,.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(AS / 2, 6); x.lineTo(AS / 2, AS - 6); x.stroke(); x.setLineDash([]);
    // Rand
    x.strokeStyle = INK; x.lineWidth = 4.2; sk.beginPath(); sk.rect(0, 0, AS, AS); sk.stroke();
    x.lineWidth = 2; x.globalAlpha = .6; const sk2 = sketchCtx(x, 8.1 + f * 2.3, AS * .35); sk2.lineWidth = 2; sk2.beginPath(); sk2.rect(-4, -4, AS + 8, AS + 8); sk2.stroke(); x.globalAlpha = 1;
    fr.push(cv);
  }
  sp = { fr, pad, side };
  AR.set(AS, sp);
  return sp;
}
export function drawArenaFrame(g, ax, ay, AS, tf) {
  const sp = arenaSprite(AS);
  g.drawImage(sp.fr[((tf % 3) + 3) % 3], ax - sp.pad, ay - sp.pad, sp.side, sp.side);
}
let shk = 0;
// Arena an (ax, ay) mit Kantenlänge AS. over = {noFxAdvance}
export function drawArena(g, ax, ay, AS, sim, tf, tm, dt, mySlot, players, opt) {
  opt = opt || {};
  drawArenaFrame(g, ax, ay, AS, tf);
  g.save();
  g.beginPath(); g.rect(ax + 2, ay + 2, AS - 4, AS - 4); g.clip();
  // Wackeln
  if (fxState.shake > .05) { g.translate((Math.random() - .5) * fxState.shake * 1.6, (Math.random() - .5) * fxState.shake * 1.6); fxState.shake *= Math.pow(.02, dt); }
  g.translate(ax, ay); const k = AS / BOX; g.scale(k, k);
  for (const e of sim.fx) addFx(e);
  sim.fx.length = 0;
  const objs = sim.objs, myTeam = players && mySlot >= 0 && players[mySlot] ? players[mySlot].team : 0;
  for (let i = 0; i < objs.length; i++) if (GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  for (const b of sim.balls) {
    if (b.dead) continue;
    const col = b.team === myTeam ? TEAM_COL[0] : TEAM_COL[1];
    g.save(); g.globalAlpha = .9; ringJ(g, b.x, b.y + 1, b.r + 4, 2.6, col, tf, b.id); g.restore();
  }
  for (const b of sim.balls) if (!b.dead) drawBall(g, b, sim, tf, tm, opt.tint && opt.tint[b.id]);
  for (let i = 0; i < objs.length; i++) if (!GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  for (const b of sim.balls) if (!b.dead && !opt.noBars) drawHpBar(g, b, myTeam, '#4f90e8', '#e4574a');
  drawFx(g, dt, tf);
  g.restore();
}

/* ---------- Ballbox ---------- */
// Spielfeld: oben kippt eine Kiste und schüttet die Bälle aus, unten fängt ein geschlossener Becher den Gewinner auf.
const BOARD = {};
const TOP = 190;                       // Platz über dem Spielfeld für die Kiste (Weltkoordinaten -TOP..)
export const BOX_H = BH + 186;         // sichtbare Höhe: von y = -170 bis unter den Becher
const CUP = { x0: 96, x1: 204, y0: 376, y1: 442 };
function boardSprite(col) {
  if (BOARD[col]) return BOARD[col];
  const sc = Math.min(2, DPR), W = BW + 40, H = BH + TOP + 50, fr = [];
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * sc); cv.height = Math.ceil(H * sc);
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(20, TOP);
    x.lineJoin = x.lineCap = 'round';
    const sk = sketchCtx(x, strSeed(col) + f * 1.9, 120); x.strokeStyle = INK; x.lineWidth = 3.6; sk.lineWidth = 3.6;
    // Hintergrund in Boxfarbe, begrenzt durch Wände
    x.save(); x.beginPath(); x.moveTo(0, -TOP); x.lineTo(BW, -TOP); x.lineTo(BW, 175); x.lineTo(BW - 135, 372); x.lineTo(BW - 135, 392); x.lineTo(135, 392); x.lineTo(135, 372); x.lineTo(0, 175); x.closePath(); x.clip();
    x.fillStyle = '#f6efd9'; x.fillRect(-20, -TOP, W, H);
    x.globalAlpha = .22; x.fillStyle = col; x.fillRect(-20, -TOP, W, H); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(29,39,66,.08)'; x.lineWidth = 1.5; for (let i = -TOP; i < 420; i += 22) { x.beginPath(); x.moveTo(-20, i); x.lineTo(BW + 20, i + 10); x.stroke(); }
    // Zielzone: Streifen zum Becher
    x.globalAlpha = .18; x.fillStyle = '#ffd45a'; x.fillRect(135, 330, 30, 70); x.globalAlpha = 1;
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 3.6;
    sk.beginPath(); sk.moveTo(0, -TOP); sk.lineTo(0, 175); sk.lineTo(135, 372); sk.lineTo(135, 392); sk.stroke();
    sk.beginPath(); sk.moveTo(BW, -TOP); sk.lineTo(BW, 175); sk.lineTo(BW - 135, 372); sk.lineTo(BW - 135, 392); sk.stroke();
    // Nieten entlang der Wände
    x.fillStyle = col;
    for (let y = -120; y < 170; y += 38) for (const px of [6, BW - 6]) { x.beginPath(); x.arc(px, y, 2.6, 0, 7); x.fill(); x.lineWidth = 1.4; x.stroke(); }
    x.lineWidth = 3.6;
    PEGS.forEach(p => {
      x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.fillStyle = p[3] ? '#e0533a' : '#d9c9a0'; x.fill();
      sk.beginPath(); sk.arc(p[0], p[1], p[2], 0, 7); sk.lineWidth = 2.4; sk.stroke();
      if (p[3]) { sk.beginPath(); sk.arc(p[0], p[1], p[2] + 4.5, 0, 7); sk.lineWidth = 1.6; sk.strokeStyle = 'rgba(224,83,58,.7)'; sk.stroke(); sk.strokeStyle = INK; x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0], p[1], p[2] * .38, 0, 7); x.fill(); }
    });
    // Auffangbecher unten: geschlossen, mit Boden
    x.beginPath(); x.moveTo(CUP.x0, CUP.y0); x.lineTo(CUP.x0 + 8, CUP.y1); x.lineTo(CUP.x1 - 8, CUP.y1); x.lineTo(CUP.x1, CUP.y0); x.closePath();
    x.fillStyle = '#fff9e0'; x.fill();
    x.save(); x.clip(); x.globalAlpha = .3; x.fillStyle = col; x.fillRect(CUP.x0, CUP.y0, CUP.x1 - CUP.x0, 70); x.restore();
    sk.lineWidth = 3.6; sk.beginPath(); sk.moveTo(CUP.x0 - 6, CUP.y0 - 2); sk.lineTo(CUP.x0, CUP.y0); sk.lineTo(CUP.x0 + 8, CUP.y1); sk.lineTo(CUP.x1 - 8, CUP.y1); sk.lineTo(CUP.x1, CUP.y0); sk.lineTo(CUP.x1 + 6, CUP.y0 - 2); sk.stroke();
    fr.push(cv);
  }
  return (BOARD[col] = { fr, W, H });
}
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
// Die Kiste oben: kippt, schüttet die Bälle aus, richtet sich auf und verschwindet nach oben
function drawPourer(g, boxId, s, tm) {
  const st = s.step, tilt = ease(st / 55) * 1.78 - ease((st - 150) / 40) * 1.78;
  const lift = Math.max(0, st - 190) * 2.6, shake = st > 40 && st < 150 ? Math.sin(st * .9) * .025 : 0;
  if (lift > 220) return;
  g.save(); g.globalAlpha = 1 - Math.min(1, lift / 200);
  g.translate(106, -72 - lift); g.rotate(tilt + shake + (st < 55 ? Math.sin(st * .6) * .03 * (1 - st / 55) : 0)); g.scale(1.35, 1.35); g.translate(-50, -70);
  drawBoxArt(g, boxId || 'standard', tm, 100, { open: 1 });
  g.restore();
}
export function drawBox(g, W, s, cands, tm, tf, hi, col, boxId) {
  const k = W / BW;
  g.save(); g.scale(k, k); g.translate(0, 170);
  const B = boardSprite(col || '#d9a441');
  g.drawImage(B.fr[((tf % 3) + 3) % 3], -20, -TOP, B.W, B.H);
  // Windräder (drehen sich mit der Simulationszeit), handgezeichnet wie alles andere: wackelige Kontur, versetzte Füllung, Schraffur
  for (const sp of SPINNERS) {
    const a = s.t * sp.om;
    g.save(); g.translate(sp.x, sp.y); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      g.save(); g.rotate(a + i * Math.PI);
      const sk = sketchCtx(g, strSeed('wind') + ((tf + i) % 3) * 1.9, 40); g.lineWidth = 3; sk.lineWidth = 3; g.strokeStyle = INK;
      sk.beginPath(); sk.moveTo(0, -sp.w - 1); sk.lineTo(sp.len, -sp.w - 1); sk.lineTo(sp.len + 3, 0); sk.lineTo(sp.len, sp.w + 1); sk.lineTo(0, sp.w + 1); sk.closePath();
      g.fillStyle = i ? '#4fa3e8' : '#ffd45a'; sk.fill(); sk.stroke();
      g.save(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,.7)'; sk.beginPath(); for (let x = 8; x < sp.len - 2; x += 7) { sk.moveTo(x, sp.w - 1); sk.lineTo(x + 4, -sp.w + 1); } sk.stroke(); g.restore();
      g.restore();
    }
    const sk = sketchCtx(g, strSeed('windhub') + (tf % 3) * 1.9, 20); g.lineWidth = 3; sk.lineWidth = 3; g.strokeStyle = INK;
    sk.beginPath(); sk.arc(0, 0, 7.5, 0, 7); g.fillStyle = '#e0533a'; sk.fill(); sk.stroke();
    g.restore();
  }
  drawPourer(g, boxId, s, tm);
  s.balls.forEach((b, i) => {
    if (!b.on) return;
    const type = cands[i], rar = RARITY[DEFS[type].rarity], sp = bodySprite(type);
    let x = b.x, y = b.y;
    if (b.done) {   // gelandet: rollt im Becher an seinen Platz (Gewinner in der Mitte)
      const rank = s.order.indexOf(i), tx = 150 + [0, -26, 26][rank] || 150, fl = CUP.y1 - BR - 4 - (rank > 2 ? 0 : 0);
      x = b.x + (tx - b.x) * ease((b.y - EXIT_Y) / 22); y = Math.min(b.y, fl);
    }
    g.save(); g.translate(x, y); g.rotate(b.rot * .6);
    const w = BR * 2 * 3.1, f = (tf + i) % 3;
    g.drawImage(sp.fr[f], -w / 2, -w / 2, w, w); g.restore();
    ringJ(g, x, y, BR + 1.5, 2.2, rar.color, tf, i + 3);
    if (hi === i) { star(g, x, y - BR - 9, 6, '#ffd45a', tm * 3); ringJ(g, x, y, BR + 5, 2.6, '#e0a800', tf, i); }
  });
  // vordere Becherkante, damit die Bälle im Becher liegen
  g.save(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(CUP.x0, CUP.y0 + 6); g.lineTo(CUP.x0 + 8, CUP.y1); g.lineTo(CUP.x1 - 8, CUP.y1); g.lineTo(CUP.x1, CUP.y0 + 6); g.closePath(); g.fill(); g.restore();
  for (let i = 0; i < 3; i++) star(g, BW / 2 + (i - 1) * 18, 352 + ((tf + i) % 2) * 2 - Math.abs(Math.sin(tm * 3 + i)) * 3, 4.5, '#ffd45a', tm * 2 + i);
  g.restore();
}
