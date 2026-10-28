// Arena und Ballbox-Minispiel zeichnen.
import { BOX } from './engine.js';
import { insetOf } from './core.js';
import { BW, BH, BR, EXIT_Y, layoutOf } from './boxsim.js';
import { DEFS, RARITY } from './engine.js';
import { INK, DPR, mkSprite, sketchCtx, strSeed } from './sk.js';
import { bodySprite, drawBall, drawObj, drawFx, addFx, drawHpBar, ringJ, star, fxState, GROUND } from './art.js';
import { R0 } from './ballart.js';
import { drawBoxArt } from './boxart.js';
import { SKIN, drawSkinWall } from './dropskin.js';

export const TEAM_COL = ['#2b6fd0', '#d33a3a'];
export const PLAYER_COL = ['#2b6fd0', '#d33a3a', '#2f9a4a', '#e0a21a'];

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
  const gr = Math.max(0, sim.grow || 0), k = AS / (BOX + 2 * gr);   // Kleiner Großer: Kamera zoomt heraus, die Arena ist größer
  g.translate(ax + gr * k, ay + gr * k); g.scale(k, k);
  for (const e of sim.fx) addFx(e);
  sim.fx.length = 0;
  const ffa = players && players.length > 2 && players.every((p, i) => p.team === i), objs = sim.objs, myTeam = players && mySlot >= 0 && players[mySlot] ? players[mySlot].team : 0;
  for (let i = 0; i < objs.length; i++) if (GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  for (const b of sim.balls) {
    if (b.dead) continue;
    const col = ffa ? PLAYER_COL[b.team] : b.team === myTeam ? TEAM_COL[0] : TEAM_COL[1];
    g.save(); g.globalAlpha = .9; ringJ(g, b.x, b.y + 1, b.r + 4, 2.6, col, tf, b.id); g.restore();
  }
  for (const b of sim.balls) if (!b.dead) drawBall(g, b, sim, tf, tm, opt.tint && opt.tint[b.id]);
  for (let i = 0; i < objs.length; i++) if (!GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  // Zusammenrückende Wände (Wut-Phase): gestreifter Warnrand und neue Wandlinie
  const ins = insetOf(sim);
  if (ins > .5) {
    // Neue Wand handgezeichnet: wackelige Doppellinie, Buntstift-Schraffur im gesperrten Rand
    g.save(); g.beginPath(); g.rect(0, 0, BOX, BOX); g.rect(ins, ins, BOX - 2 * ins, BOX - 2 * ins); g.clip('evenodd');
    g.fillStyle = 'rgba(224,83,58,.2)'; g.fillRect(0, 0, BOX, BOX);
    const sh = sketchCtx(g, 3.1 + (tf % 3) * 1.713, 46); g.strokeStyle = 'rgba(200,70,45,.5)'; g.lineWidth = 2.2; sh.lineWidth = 2.2;
    sh.beginPath(); for (let i = -BOX; i < BOX * 2; i += 15) { sh.moveTo(i, 0); sh.lineTo(i + BOX, BOX); } sh.stroke();
    g.restore();
    g.save(); g.lineJoin = g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3.4;
    const wl = sketchCtx(g, 9.7 + (tf % 3) * 1.713, 70); wl.lineWidth = 3.4;
    wl.beginPath(); wl.rect(ins, ins, BOX - 2 * ins, BOX - 2 * ins); wl.stroke();
    g.restore();
  }
  for (const b of sim.balls) if (!b.dead && !opt.noBars) drawHpBar(g, b, myTeam, '#4f90e8', '#e4574a', ffa ? PLAYER_COL : null);
  drawFx(g, dt, tf);
  g.restore();
}

/* ---------- Ballbox ---------- */
// Spielfeld: oben kippt eine Kiste und schüttet die Bälle aus, unten fängt ein geschlossener Becher den Gewinner auf.
const BOARD = {};
export function clearBoardCache() { for (const k in BOARD) delete BOARD[k]; }   // für den Dropper-Editor: Layout hat sich geändert
const TOP = 190;                       // Platz über dem Spielfeld für die Kiste (Weltkoordinaten -TOP..)
export const BOX_H = BH + 186;         // sichtbare Höhe: von y = -170 bis unter den Becher
const CUP = { x0: 96, x1: 204, y0: 376, y1: 442 };
// Halloween: Nachthimmel mit Mond, Sternen, kahlem Baum, Zaun und Spinnweben in den Ecken
function nightDecor(x, sk, f) {
  x.lineJoin = x.lineCap = 'round';
  x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 26; i++) { const sx2 = (i * 53) % 300, sy2 = -170 + (i * 37) % 300; x.beginPath(); x.arc(sx2, sy2, 1 + (i % 3) * .6, 0, 7); x.fill(); }
  // Mond
  x.fillStyle = '#fff1b0'; sk.lineWidth = 2.6; sk.strokeStyle = INK; sk.beginPath(); sk.arc(232, -92, 34, 0, 7); sk.fill(); sk.stroke();
  x.fillStyle = 'rgba(210,190,120,.7)'; [[222, -102, 7], [244, -84, 5], [226, -78, 4]].forEach(c => { x.beginPath(); x.arc(c[0], c[1], c[2], 0, 7); x.fill(); });
  // kahler Baum links
  sk.lineWidth = 4; sk.strokeStyle = '#1f1738'; sk.beginPath(); sk.moveTo(14, 175); sk.quadraticCurveTo(22, 90, 18, 20); sk.moveTo(20, 80); sk.quadraticCurveTo(50, 60, 62, 20); sk.moveTo(19, 110); sk.quadraticCurveTo(-4, 90, -6, 62); sk.moveTo(21, 50); sk.quadraticCurveTo(38, 38, 40, 4); sk.stroke(); sk.strokeStyle = INK;
  // Zaun unten
  sk.lineWidth = 2.6; sk.strokeStyle = '#1f1738'; for (let i = 0; i < 8; i++) { const fx2 = 8 + i * 38; sk.beginPath(); sk.moveTo(fx2, 330); sk.lineTo(fx2, 296); sk.lineTo(fx2 + 4, 288); sk.lineTo(fx2 + 8, 296); sk.lineTo(fx2 + 8, 330); sk.stroke(); }
  sk.strokeStyle = INK;
  // Spinnweben in den oberen Ecken
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2;
  for (const cx of [0, 300]) { const d = cx ? -1 : 1; for (let k = 0; k < 5; k++) { const a = k / 4 * 1.57; x.beginPath(); x.moveTo(cx, -170); x.lineTo(cx + d * Math.cos(a) * 70, -170 + Math.sin(a) * 70); x.stroke(); } for (let r2 = 20; r2 <= 60; r2 += 20) { x.beginPath(); for (let k = 0; k <= 4; k++) { const a = k / 4 * 1.57, px = cx + d * Math.cos(a) * r2, py = -170 + Math.sin(a) * r2; k ? x.quadraticCurveTo(cx + d * Math.cos(a - .2) * r2 * .85, -170 + Math.sin(a - .2) * r2 * .85, px, py) : x.moveTo(px, py); } x.stroke(); } }
}
function tombstone(x, sk, p) {
  const [px, py, r, kind] = p;
  if (kind) {   // rote Bumper: Kerzen
    x.fillStyle = '#f4e9c8'; sk.lineWidth = 2.4; sk.strokeStyle = INK; sk.beginPath(); sk.moveTo(px - r, py + r); sk.lineTo(px - r, py - r * .6); sk.lineTo(px + r, py - r * .6); sk.lineTo(px + r, py + r); sk.closePath(); sk.fill(); sk.stroke();
    sk.lineWidth = 1.6; sk.strokeStyle = 'rgba(224,83,58,.8)'; sk.beginPath(); sk.arc(px, py, r + 5, 0, 7); sk.stroke(); sk.strokeStyle = INK; return;
  }
  x.fillStyle = '#b9b6c9'; sk.lineWidth = 2.4; sk.strokeStyle = INK;
  sk.beginPath(); sk.moveTo(px - r, py + r); sk.lineTo(px - r, py - r * .3); sk.quadraticCurveTo(px - r, py - r * 1.3, px, py - r * 1.3); sk.quadraticCurveTo(px + r, py - r * 1.3, px + r, py - r * .3); sk.lineTo(px + r, py + r); sk.closePath(); sk.fill(); sk.stroke();
  sk.lineWidth = 1.5; sk.beginPath(); sk.moveTo(px, py - r * .7); sk.lineTo(px, py + r * .35); sk.moveTo(px - r * .45, py - r * .25); sk.lineTo(px + r * .45, py - r * .25); sk.stroke();
}
// Handgezeichnete Besonderheiten der Dropper (Gitter, Körbe, Gitterablagen, Block, Flummi, Kanonen)
function wob(sk, pts, close) { sk.beginPath(); pts.forEach((q, i) => i ? sk.lineTo(q[0], q[1]) : sk.moveTo(q[0], q[1])); if (close) sk.closePath(); }
function drawDropperDecor(x, sk, L, skin) {
  x.lineJoin = x.lineCap = 'round';
  // alles mit wackeliger Kontur und versetzter Füllung (sk.fill / sk.stroke), nie mit geraden Canvas-Füllungen
  const shape = (pts, col, lw) => { sk.lineWidth = lw || 3.2; sk.strokeStyle = INK; x.strokeStyle = INK; x.fillStyle = col; wob(sk, pts, true); sk.fill(); sk.stroke(); };
  const rect = (x0, y0, x1, y1, col, lw) => shape([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], col, lw);
  if (L.grates) for (const r of L.grates) {   // Gitter: dunkler Schacht mit Stäben
    if (skin && skin.grate) { skin.grate(x, sk, r, rect); continue; }
    rect(r[0], r[1], r[2], r[3], '#3b3a46');
    sk.lineWidth = 2.4; sk.strokeStyle = '#9a98a8';
    for (let gx = r[0] + 7; gx < r[2] - 3; gx += 12) { sk.beginPath(); sk.moveTo(gx, r[1] + 3); sk.lineTo(gx, r[3] - 3); sk.stroke(); }
    sk.beginPath(); sk.moveTo(r[0] + 3, r[1] + 5); sk.lineTo(r[2] - 3, r[1] + 5); sk.stroke();
    sk.strokeStyle = INK;
  }
  if (L.cups && L.theme === 'halloween') for (const c of L.cups) {   // Hexenkessel
    const w = c.x1 - c.x0, h = c.y1 - c.y0, cx = (c.x0 + c.x1) / 2;
    shape([[c.x0 + 3, c.y0 - 2], [c.x1 - 3, c.y0 - 2], [c.x1 + 2, c.y0 + h * .5], [c.x1 - 5, c.y1 - 1], [c.x0 + 5, c.y1 - 1], [c.x0 - 2, c.y0 + h * .5]], '#2b2b36');
    x.fillStyle = '#7ad66a'; sk.lineWidth = 2.4; sk.strokeStyle = INK; sk.beginPath(); sk.moveTo(c.x0 + 2, c.y0 - 2); sk.quadraticCurveTo(cx, c.y0 + 7, c.x1 - 2, c.y0 - 2); sk.quadraticCurveTo(cx, c.y0 - 7, c.x0 + 2, c.y0 - 2); sk.fill(); sk.stroke();
    sk.lineWidth = 2.6; sk.beginPath(); sk.moveTo(c.x0 + 8, c.y1); sk.lineTo(c.x0 + 5, c.y1 + 6); sk.moveTo(c.x1 - 8, c.y1); sk.lineTo(c.x1 - 5, c.y1 + 6); sk.stroke();
  }
  else if (L.cups) for (const c of L.cups) {   // Fangkörbe: geflochten
    shape([[c.x0, c.y0 - 4], [c.x0, c.y1], [c.x1, c.y1], [c.x1, c.y0 - 4], [c.x1 - 5, c.y0 - 4], [c.x1 - 5, c.y1 - 5], [c.x0 + 5, c.y1 - 5], [c.x0 + 5, c.y0 - 4]], '#c98b3a');
    sk.lineWidth = 1.6; sk.strokeStyle = '#7a4a21'; for (let yy = c.y0 + 4; yy < c.y1; yy += 6) { sk.beginPath(); sk.moveTo(c.x0 + 1, yy); sk.lineTo(c.x1 - 1, yy + 2); sk.stroke(); }
    sk.strokeStyle = INK;
  }
  if (L.grids) for (const g of L.grids) {   // Gitterablagen: dicke Platte mit Gitter darunter
    if (skin && skin.grid) { skin.grid(x, sk, g, shape); continue; }
    const dx = g[2] - g[0], dy = g[3] - g[1], hgt = 30;
    shape([[g[0], g[1]], [g[2], g[3]], [g[2], g[3] + hgt], [g[0], g[1] + hgt]], 'rgba(255,255,255,.55)', 3.4);
    sk.lineWidth = 2; sk.strokeStyle = INK;
    for (let i = 1; i < 6; i++) { const t = i / 6; sk.beginPath(); sk.moveTo(g[0] + dx * t, g[1] + dy * t + 2); sk.lineTo(g[0] + dx * t, g[1] + dy * t + hgt - 1); sk.stroke(); }
    sk.beginPath(); sk.moveTo(g[0] + 2, g[1] + hgt * .5); sk.lineTo(g[2] - 2, g[3] + hgt * .5); sk.stroke();
  }
  if (L.blocks) for (const r of L.blocks) {   // feste Blöcke
    rect(r[0], r[1], r[2], r[3], '#e8d9a8');
    sk.lineWidth = 1.6; sk.beginPath(); sk.moveTo(r[0] + 4, (r[1] + r[3]) / 2); sk.lineTo(r[2] - 4, (r[1] + r[3]) / 2); sk.stroke();
  }
  if (L.webs) for (const w of L.webs) {   // Spinnennetze
    x.strokeStyle = 'rgba(255,255,255,.85)'; sk.strokeStyle = 'rgba(255,255,255,.9)'; sk.lineWidth = 1.6;
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; sk.beginPath(); sk.moveTo(w.x, w.y); sk.lineTo(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r); sk.stroke(); }
    for (let r2 = w.r * .3; r2 <= w.r; r2 += w.r * .24) { sk.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * 6.2832, rr = r2 * (k % 2 ? .93 : 1); k ? sk.lineTo(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr) : sk.moveTo(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr); } sk.stroke(); }
    sk.strokeStyle = INK; x.strokeStyle = INK;
  }
  if (L.flum && L.theme === 'halloween') for (const f of L.flum) {   // Kürbis-Flummis
    x.fillStyle = '#f58a1f'; sk.lineWidth = 3.2; sk.strokeStyle = INK; sk.beginPath(); sk.ellipse(f[0], f[1], f[2] * 1.08, f[2], 0, 0, 7); sk.fill(); sk.stroke();
    sk.lineWidth = 1.8; sk.strokeStyle = '#b4560c'; sk.beginPath(); sk.moveTo(f[0], f[1] - f[2]); sk.quadraticCurveTo(f[0] - f[2] * .55, f[1], f[0], f[1] + f[2]); sk.moveTo(f[0], f[1] - f[2]); sk.quadraticCurveTo(f[0] + f[2] * .55, f[1], f[0], f[1] + f[2]); sk.stroke();
    x.fillStyle = '#3a2a24'; sk.strokeStyle = INK; sk.lineWidth = 1.4; [[-.42, -.2], [.42, -.2]].forEach(q => { sk.beginPath(); sk.moveTo(f[0] + q[0] * f[2] - 3, f[1] + q[1] * f[2] + 3); sk.lineTo(f[0] + q[0] * f[2], f[1] + q[1] * f[2] - 3); sk.lineTo(f[0] + q[0] * f[2] + 3, f[1] + q[1] * f[2] + 3); sk.closePath(); sk.fill(); sk.stroke(); });
    sk.beginPath(); sk.moveTo(f[0] - f[2] * .5, f[1] + f[2] * .35); sk.lineTo(f[0] - f[2] * .25, f[1] + f[2] * .55); sk.lineTo(f[0], f[1] + f[2] * .35); sk.lineTo(f[0] + f[2] * .25, f[1] + f[2] * .55); sk.lineTo(f[0] + f[2] * .5, f[1] + f[2] * .35); sk.stroke();
    x.fillStyle = '#5cae4a'; sk.lineWidth = 2; sk.beginPath(); sk.moveTo(f[0] - 2, f[1] - f[2]); sk.lineTo(f[0] - 1, f[1] - f[2] - 6); sk.lineTo(f[0] + 4, f[1] - f[2] - 5); sk.lineTo(f[0] + 3, f[1] - f[2]); sk.closePath(); sk.fill(); sk.stroke();
  }
  else if (L.flum && skin && skin.flum) for (const f of L.flum) skin.flum(x, sk, f);
  else if (L.flum) for (const f of L.flum) {   // Flummi-Bumper
    x.fillStyle = '#ff6fb0'; sk.lineWidth = 3.2; sk.strokeStyle = INK; sk.beginPath(); sk.arc(f[0], f[1], f[2], 0, 7); sk.fill(); sk.stroke();
    x.fillStyle = '#fff'; sk.lineWidth = 2; sk.beginPath(); sk.arc(f[0], f[1], f[2] * .55, 0, 7); sk.fill(); sk.stroke();
  }
  if (L.cannons) for (const c of L.cannons) {   // Kanonenrohre entlang der Schrägen (Punkte von Hand gedreht)
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, a = Math.atan2(c.ty - cy, c.tx - cx) + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);   // Rohr zeigt zum Ziel
    const R = pts => pts.map(q => [cx + q[0] * ca - q[1] * sa, cy + q[0] * sa + q[1] * ca]);
    shape(R([[-11, -20], [11, -20], [11, 20], [-11, 20]]), '#7e8696', 3);
    shape(R([[-13, -24], [13, -24], [13, -17], [-13, -17]]), '#4b5160', 2.4);
    shape(R([[-7, 3], [7, 3], [7, 9], [-7, 9]]), '#2d303a', 1.6);
  }
}
function boardSprite(col, L, boxId) {
  const skin = L.theme ? null : SKIN[boxId];   // Themen-Boxen: gleiche Elemente, eigene Optik
  const key = col + L.id + (skin ? boxId : '');
  if (BOARD[key]) return BOARD[key];
  const sc = Math.min(2, DPR), W = BW + 40, H = BH + TOP + 50, fr = [];
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * sc); cv.height = Math.ceil(H * sc);
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(20, TOP);
    x.lineJoin = x.lineCap = 'round';
    const sk = sketchCtx(x, strSeed(col) + f * 1.9, 120); x.strokeStyle = INK; x.lineWidth = 3.6; sk.lineWidth = 3.6;
    // Hintergrund in Boxfarbe, begrenzt durch Wände
    x.save(); x.beginPath(); L.poly.forEach((q, i) => i ? x.lineTo(q[0], Math.max(q[1], -TOP)) : x.moveTo(q[0], Math.max(q[1], -TOP))); x.closePath(); x.clip();
    const night = L.theme === 'halloween';
    if (skin) skin.bg(x, sk, f);
    else if (night) { const ng = x.createLinearGradient(0, -TOP, 0, 400); ng.addColorStop(0, '#2d2350'); ng.addColorStop(.55, '#4d3b82'); ng.addColorStop(1, '#6b4a8c'); x.fillStyle = ng; x.fillRect(-20, -TOP, W, H); nightDecor(x, sk, f); }
    else { x.fillStyle = '#f6efd9'; x.fillRect(-20, -TOP, W, H);
    x.globalAlpha = .22; x.fillStyle = col; x.fillRect(-20, -TOP, W, H); x.globalAlpha = 1; }
    if (!skin) x.strokeStyle = night ? 'rgba(255,255,255,.05)' : 'rgba(29,39,66,.08)'; x.lineWidth = 1.5; if (!skin) for (let i = -TOP; i < 420; i += 22) { x.beginPath(); x.moveTo(-20, i); x.lineTo(BW + 20, i + 10); x.stroke(); }
    // Zielzone: Streifen zum Becher
    x.globalAlpha = .18; x.fillStyle = '#ffd45a'; x.fillRect(L.goal[0], L.goal[1], L.goal[2], L.goal[3]); x.globalAlpha = 1;
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 3.6;
    if (!(skin && drawSkinWall(x, sk, L.outline, boxId, TOP))) {
      for (const ln of L.outline) { sk.beginPath(); ln.forEach((q, i) => i ? sk.lineTo(q[0], Math.max(q[1], -TOP)) : sk.moveTo(q[0], Math.max(q[1], -TOP))); sk.stroke(); }
    }
    // Ablagen: Holzbretter, handgezeichnet (wacklige Kontur, versetzte Füllung, Maserung)
    for (const sh of L.shelves) {
      if (skin && skin.shelf) { skin.shelf(x, sk, sh); x.strokeStyle = INK; continue; }
      const dx = sh[2] - sh[0], dy = sh[3] - sh[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * 5, ny = ux * 5;
      x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = INK;
      sk.lineWidth = 3; sk.beginPath(); sk.moveTo(sh[0] + nx, sh[1] + ny); sk.lineTo(sh[2] + nx, sh[3] + ny); sk.lineTo(sh[2] - nx, sh[3] - ny); sk.lineTo(sh[0] - nx, sh[1] - ny); sk.closePath();
      x.fillStyle = '#d9a441'; sk.fill(); sk.stroke();
      x.strokeStyle = '#a87a2a'; sk.lineWidth = 1.6; sk.strokeStyle = '#a87a2a';
      sk.beginPath(); sk.moveTo(sh[0] + ux * 6, sh[1] + uy * 6 + 1.5); sk.lineTo(sh[2] - ux * 6, sh[3] - uy * 6 + 1.5); sk.moveTo(sh[0] + ux * 10 + nx * .3, sh[1] + uy * 10 - 2); sk.lineTo(sh[0] + ux * L * .55, sh[1] + uy * L * .55 - 2); sk.stroke();
      sk.strokeStyle = INK; x.strokeStyle = INK;
    }
    x.strokeStyle = INK; x.lineWidth = 3.6;
    L.pegs.forEach((p, pi) => {
      if (L.theme === 'halloween') { tombstone(x, sk, p); return; }
      if (skin) { (p[3] ? skin.bump : skin.peg)(x, sk, p, pi); return; }
      x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.fillStyle = p[3] ? '#e0533a' : '#d9c9a0'; x.fill();
      sk.beginPath(); sk.arc(p[0], p[1], p[2], 0, 7); sk.lineWidth = 2.4; sk.stroke();
      if (p[3]) { sk.beginPath(); sk.arc(p[0], p[1], p[2] + 4.5, 0, 7); sk.lineWidth = 1.6; sk.strokeStyle = 'rgba(224,83,58,.7)'; sk.stroke(); sk.strokeStyle = INK; x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0], p[1], p[2] * .38, 0, 7); x.fill(); }
    });
    drawDropperDecor(x, sk, L, skin);
    if (skin && skin.cup) skin.cup(x, sk, CUP, col);
    else {
    // Auffangbecher unten: geschlossen, mit Boden
    x.beginPath(); x.moveTo(CUP.x0, CUP.y0); x.lineTo(CUP.x0 + 8, CUP.y1); x.lineTo(CUP.x1 - 8, CUP.y1); x.lineTo(CUP.x1, CUP.y0); x.closePath();
    x.fillStyle = '#fff9e0'; x.fill();
    x.save(); x.clip(); x.globalAlpha = .3; x.fillStyle = col; x.fillRect(CUP.x0, CUP.y0, CUP.x1 - CUP.x0, 70); x.restore();
    sk.lineWidth = 3.6; sk.beginPath(); sk.moveTo(CUP.x0 - 6, CUP.y0 - 2); sk.lineTo(CUP.x0, CUP.y0); sk.lineTo(CUP.x0 + 8, CUP.y1); sk.lineTo(CUP.x1 - 8, CUP.y1); sk.lineTo(CUP.x1, CUP.y0); sk.lineTo(CUP.x1 + 6, CUP.y0 - 2); sk.stroke();
    }
    fr.push(cv);
  }
  return (BOARD[key] = { fr, W, H });
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
  const k = W / (BW + 16);   // 8 Einheiten Rand links und rechts, damit die Wandlinien nicht am Bildrand abgeschnitten werden
  g.save(); g.scale(k, k); g.translate(8, 170);
  const L = s.L || layoutOf(boxId), B = boardSprite(col || '#d9a441', L, boxId);
  g.drawImage(B.fr[((tf % 3) + 3) % 3], -20, -TOP, B.W, B.H);
  // Windräder (drehen sich mit der Simulationszeit), handgezeichnet wie alles andere: wackelige Kontur, versetzte Füllung, Schraffur
  // Wind: gestrichelte Streifen laufen nach außen; Kanonen blitzen beim Abschuss
  if (L.wind) for (const w of L.wind) {   // Wind: wenige, ruhige Schwünge, die in Windrichtung durch die Fläche ziehen und ein- und ausblenden
    g.save(); g.beginPath(); g.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); g.clip();
    g.beginPath(); L.poly.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.clip();   // nur im Dropper-Inneren
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#5a9ee0';
    const wd = w.x1 - w.x0, ht = w.y1 - w.y0, horiz = Math.abs(w.ax) >= Math.abs(w.ay), sgn = (horiz ? w.ax : w.ay) < 0 ? -1 : 1;
    const sk = sketchCtx(g, 3.9 + (tf % 3) * 1.713, 22), span = horiz ? wd : ht, thick = horiz ? ht : wd;
    const lanes = Math.max(1, Math.round(thick / 16)), per = Math.max(1, Math.round(span / 46));   // gleichmäßige Bahnen, auf jeder Bahn gleichmäßig verteilte Schwünge
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#6aa6e4'; g.lineWidth = 1.8; sk.lineWidth = 1.8;
    for (let l = 0; l < lanes; l++) for (let k = 0; k < per; k++) {
      const t = (tm * .65 + (k + (l % 2) * .5 + l * .17) / per) % 1, fade = Math.sin(t * Math.PI);
      const along = sgn > 0 ? t * span : span - t * span, lane = (l + .5) / lanes * thick;
      const px = horiz ? w.x0 + along : w.x0 + lane, py = horiz ? w.y0 + lane : w.y0 + along, dx = horiz ? sgn * 5 : 0, dy = horiz ? 0 : sgn * 5;
      g.globalAlpha = .75 * fade;
      sk.beginPath(); sk.moveTo(px - dx, py - dy); sk.quadraticCurveTo(px - dy * .5, py + dx * .5, px + dx, py + dy); sk.stroke();
    }
    g.restore();
  }
  if (L.cannons) for (const c of L.cannons) {
    if (c.fire !== undefined && s.step - c.fire < 14) {
      const k = 1 - (s.step - c.fire) / 14, cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, d = Math.hypot(c.tx - cx, c.ty - cy) || 1;
      star(g, cx + (c.tx - cx) / d * 26, cy + (c.ty - cy) / d * 26, 9 * k + 3, '#ffe14a', tm * 6);
    }
  }
  if (L.portals) for (const p of L.portals) {   // Geister-Portale: drehende Wirbel
    const dh = p.hit === undefined ? 99 : s.step - p.hit, gl = dh >= 0 && dh < 20 ? 1 + (20 - dh) / 20 * .35 : 1;
    for (const [px, py] of [[p.ax, p.ay], [p.bx, p.by]]) {
      g.save(); g.translate(px, py); g.scale(gl, gl); g.lineCap = 'round'; const sk = sketchCtx(g, 5.5 + (tf % 3) * 1.713, 24); g.lineWidth = 2.6; sk.lineWidth = 2.6;
      g.fillStyle = 'rgba(60,20,110,.75)'; g.strokeStyle = INK; sk.beginPath(); sk.arc(0, 0, p.r, 0, 7); sk.fill(); sk.stroke();
      g.strokeStyle = '#c9a6ff'; g.lineWidth = 2; sk.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const a0 = tm * 3.2 + i * 3.14; sk.beginPath(); for (let k = 0; k <= 14; k++) { const t2 = k / 14, rr = p.r * (.15 + .75 * t2), aa = a0 + t2 * 5; k ? sk.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : sk.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } sk.stroke(); }
      g.restore();
    }
  }
  if (L.theme === 'halloween') {   // Kerzenflammen und Spinnen an den Netzen
    for (const p of L.pegs) if (p[3]) { const fl = 1 + Math.sin(tm * 11 + p[0]) * .22; g.save(); g.translate(p[0], p[1] - p[2] * .6); g.scale(fl, fl); g.fillStyle = '#ffb02e'; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(-3, -7, 0, -11); g.quadraticCurveTo(4, -6, 3, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ffe14a'; g.beginPath(); g.ellipse(0, -3, 1.4, 3, 0, 0, 7); g.fill(); g.restore(); }
    if (L.webs) for (const w of L.webs) { const sy2 = w.y - w.r - 4 + Math.abs(Math.sin(tm * 1.3 + w.x)) * 14; g.save(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(w.x, w.y - w.r - 18); g.lineTo(w.x, sy2); g.stroke(); g.fillStyle = '#2a2236'; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(w.x, sy2 + 3, 3.6, 0, 7); g.fill(); g.stroke(); for (let k = -2; k <= 2; k++) { if (!k) continue; g.beginPath(); g.moveTo(w.x, sy2 + 3); g.lineTo(w.x + k * 3.6, sy2 + 3 + Math.abs(k) * 1.6 + 2); g.stroke(); } g.restore(); }
  }
  for (const sp of L.spinners) {
    const a = s.t * sp.om;
    if (L.theme === 'halloween') {   // Fledermaus: zwei Flügel, die sich mit dem Propeller drehen
      g.save(); g.translate(sp.x, sp.y); g.lineCap = g.lineJoin = 'round';
      for (let i = 0; i < 2; i++) {
        g.save(); g.rotate(a + i * Math.PI); const sk = sketchCtx(g, 6.3 + ((tf + i) % 3) * 1.9, 40); g.lineWidth = 3; sk.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = '#3a2a5c';
        const L2 = sp.len, W2 = sp.w * 2.2;
        sk.beginPath(); sk.moveTo(4, -2); sk.lineTo(L2 * .35, -W2); sk.quadraticCurveTo(L2 * .5, -W2 * .2, L2 * .62, -W2 * .9); sk.quadraticCurveTo(L2 * .78, -W2 * .1, L2, -W2 * .6); sk.quadraticCurveTo(L2 * .92, W2 * .5, L2 * .72, W2 * .7); sk.quadraticCurveTo(L2 * .58, W2 * .3, L2 * .45, W2 * .9); sk.quadraticCurveTo(L2 * .3, W2 * .3, 4, 3); sk.closePath(); sk.fill(); sk.stroke();
        g.restore();
      }
      const sk0 = sketchCtx(g, 6.9 + (tf % 3) * 1.9, 20); g.lineWidth = 3; sk0.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = '#2a1f45'; sk0.beginPath(); sk0.arc(0, 0, 8, 0, 7); sk0.fill(); sk0.stroke();
      g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(-3, -1, 1.7, 0, 7); g.arc(3, -1, 1.7, 0, 7); g.fill();
      g.restore(); continue;
    }
    const skin = SKIN[boxId];
    if (skin && !L.theme) {   // Themen-Boxen: eigene Flügel und Nabe
      g.save(); g.translate(sp.x, sp.y); g.lineCap = g.lineJoin = 'round';
      for (let i = 0; i < 2; i++) { g.save(); g.rotate(a + i * Math.PI); const sk = sketchCtx(g, strSeed('sp' + boxId) + ((tf + i) % 3) * 1.9, 40); g.lineWidth = 3; sk.lineWidth = 3; g.strokeStyle = INK; skin.spinBlade(g, sk, sp, i); g.restore(); }
      const skh = sketchCtx(g, strSeed('hb' + boxId) + (tf % 3) * 1.9, 20); g.lineWidth = 3; skh.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = skin.hubCol; skh.beginPath(); skh.arc(0, 0, 7.5, 0, 7); skh.fill(); skh.stroke();
      g.restore(); continue;
    }
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
    if (b.out === 'grate' && b.y > 420) return;
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
  g.restore();
}
