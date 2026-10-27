// Dropper-Editor: baut ein Dropper-Layout (siehe public/js/boxsim.js, buildLayout) mit der echten Physik des Spiels.
import { BW, BH, BR, EXIT_Y, POUR_START, DEFS_DROPPER, buildLayout, createBox, stepBox } from '../js/boxsim.js';
import { drawBox, BOX_H, clearBoardCache } from '../js/render.js';
import { BALL_IDS } from '../js/engine.js';
import { mulberry } from '../js/core.js';

const K = 1.75, OY = 60, W0 = BW * K, H0 = (BH + OY + 10) * K;
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
cv.width = W0; cv.height = H0;

/* ---------- Daten ---------- */
const EMPTY = () => ({ id: 'meindropper', shape: { sh: 175, half: 15 }, pegs: [], segs: [], shelves: [], spinners: [], flum: [], grates: [], cups: [], cannons: [], wind: [], grids: [], blocks: [] });
let def = load() || clone(DEFS_DROPPER.gefuehl);
fill(def);
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fill(d) { for (const [k, v] of Object.entries(EMPTY())) if (d[k] === undefined) d[k] = v; return d; }
function load() { try { const t = localStorage.getItem('dropper_editor_v1'); return t ? fill(JSON.parse(t)) : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem('dropper_editor_v1', JSON.stringify(def)); } catch (e) { } }
let hist = [], hi = -1, ver = 0, stuck = [], sel = null, tool = 'select', drag = null, snap = 2;
function push() { hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(def)); if (hist.length > 120) hist.shift(); hi = hist.length - 1; changed(); }
function changed() { ver++; save(); stuck = []; syncShape(); $('json').value = exportText(); draw(); showProps(); }
function undo(n) { const j = hi + n; if (j < 0 || j >= hist.length) return; hi = j; def = fill(JSON.parse(hist[hi])); sel = null; changed(); }
$('undo').onclick = () => undo(-1); $('redo').onclick = () => undo(1);
function layout() { return buildLayout(Object.assign({}, def, { id: 'ed' + ver })); }

/* ---------- Elementarten ---------- */
const KINDS = {
  pegs: { t: 'pt', name: 'Nagel', f: [['x', 0], ['y', 1], ['Radius', 2], ['Art (0 normal, 1 Bumper)', 3]] },
  flum: { t: 'pt', name: 'Flummi', f: [['x', 0], ['y', 1], ['Radius', 2]] },
  spinners: { t: 'sp', name: 'Propeller', f: [['x', 'x'], ['y', 'y'], ['Armlänge', 'len'], ['Dicke', 'w'], ['Drehtempo', 'om']] },
  segs: { t: 'ln', name: 'Wand', f: [['x1', 0], ['y1', 1], ['x2', 2], ['y2', 3]] },
  shelves: { t: 'ln', name: 'Brett', f: [['x1', 0], ['y1', 1], ['x2', 2], ['y2', 3]] },
  grids: { t: 'ln', name: 'Gitterablage', f: [['x1', 0], ['y1', 1], ['x2', 2], ['y2', 3]] },
  grates: { t: 'rc', name: 'Gitter (schluckt Bälle)', f: [['links', 0], ['oben', 1], ['rechts', 2], ['unten', 3]] },
  blocks: { t: 'rc', name: 'Block', f: [['links', 0], ['oben', 1], ['rechts', 2], ['unten', 3]] },
  cups: { t: 'ro', name: 'Fangkorb', f: [['links', 'x0'], ['oben', 'y0'], ['rechts', 'x1'], ['unten', 'y1']] },
  cannons: { t: 'ro', name: 'Kanone', f: [['links', 'x0'], ['oben', 'y0'], ['rechts', 'x1'], ['unten', 'y1'], ['Ziel x', 'tx'], ['Ziel y', 'ty'], ['Stärke', 'pw']] },
  wind: { t: 'ro', name: 'Wind', f: [['links', 'x0'], ['oben', 'y0'], ['rechts', 'x1'], ['unten', 'y1'], ['Kraft x', 'ax'], ['Kraft y', 'ay']] }
};
const ORDER = ['grates', 'blocks', 'cups', 'wind', 'cannons', 'grids', 'shelves', 'segs', 'spinners', 'pegs', 'flum'];
const TOOLS = [
  ['select', 'Auswählen / Verschieben'], ['erase', 'Löschen'], null,
  ['peg', 'Nagel'], ['bumper', 'Roter Bumper'], ['flum', 'Flummi (Riesen-Bumper)'], ['spinner', 'Propeller'], null,
  ['wall', 'Wand (ziehen)'], ['shelf', 'Brett (ziehen)'], ['grid', 'Gitterablage (ziehen)'], ['block', 'Block (ziehen)'], null,
  ['grate', 'Gitter: schluckt Bälle'], ['cup', 'Fangkorb'], ['cannon', 'Kanone'], ['wind', 'Wind']
];
const tb = $('tools');
for (const t of TOOLS) {
  if (!t) { const h = document.createElement('h3'); h.textContent = ''; tb.appendChild(h); continue; }
  const b = document.createElement('button'); b.textContent = t[1]; b.dataset.tool = t[0];
  b.onclick = () => { tool = t[0]; sel = tool === 'select' ? sel : null; for (const x of tb.querySelectorAll('button')) x.classList.toggle('on', x === b); showProps(); draw(); };
  tb.appendChild(b);
}
tb.querySelector('button').classList.add('on');
const snapLbl = document.createElement('label'); snapLbl.innerHTML = '<span>Raster</span><input type="number" id="snap" value="2" min="1" max="20" style="width:60px">'; snapLbl.style.cssText = 'margin-top:8px;font-size:13px'; tb.appendChild(snapLbl);
$('snap').onchange = e => { snap = Math.max(1, +e.target.value || 1); };

/* ---------- Koordinaten ---------- */
const wx = e => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / K; };
const wy = e => { const r = cv.getBoundingClientRect(); return (e.clientY - r.top) / K - OY; };
const sn = v => Math.round(v / snap) * snap;
const sx = x => x * K, sy = y => (y + OY) * K;

/* ---------- Treffer und Verschieben ---------- */
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(ax + dx * t - px, ay + dy * t - py); }
function hit(x, y) {
  for (const list of ORDER) {
    const kd = KINDS[list], arr = def[list];
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (kd.t === 'pt' && Math.hypot(x - it[0], y - it[1]) < it[2] + 4) return { list, i };
      if (kd.t === 'sp' && (Math.hypot(x - it.x, y - it.y) < 10 || segDist(x, y, it.x - it.len, it.y, it.x + it.len, it.y) < it.w + 4)) return { list, i };
      if (kd.t === 'ln' && segDist(x, y, it[0], it[1], it[2], it[3]) < 5) return { list, i };
      if (kd.t === 'rc' && x > it[0] - 2 && x < it[2] + 2 && y > it[1] - 2 && y < it[3] + 2) return { list, i };
      if (kd.t === 'ro' && x > it.x0 - 2 && x < it.x1 + 2 && y > it.y0 - 2 && y < it.y1 + 2) return { list, i };
    }
  }
  return null;
}
function moveItem(s, dx, dy) {
  const kd = KINDS[s.list], it = def[s.list][s.i], o = s.orig;
  if (kd.t === 'pt') { it[0] = o[0] + dx; it[1] = o[1] + dy; }
  else if (kd.t === 'sp') { it.x = o.x + dx; it.y = o.y + dy; }
  else if (kd.t === 'ln' || kd.t === 'rc') { it[0] = o[0] + dx; it[1] = o[1] + dy; it[2] = o[2] + dx; it[3] = o[3] + dy; }
  else { it.x0 = o.x0 + dx; it.x1 = o.x1 + dx; it.y0 = o.y0 + dy; it.y1 = o.y1 + dy; if (o.tx !== undefined) { it.tx = o.tx + dx; it.ty = o.ty + dy; } }
}

/* ---------- Maus ---------- */
cv.addEventListener('mousedown', e => {
  const x = sn(wx(e)), y = sn(wy(e));
  if (tool === 'select') {
    // Ziel-Griff einer ausgewählten Kanone
    if (sel && sel.list === 'cannons') { const c = def.cannons[sel.i]; if (Math.hypot(wx(e) - c.tx, wy(e) - c.ty) < 8) { drag = { kind: 'target', s: sel }; return; } }
    const h = hit(wx(e), wy(e)); sel = h; showProps(); draw();
    if (h) { const it = def[h.list][h.i]; sel.orig = clone(it); drag = { kind: 'move', s: sel, x, y, moved: false }; }
    return;
  }
  if (tool === 'erase') { const h = hit(wx(e), wy(e)); if (h) { def[h.list].splice(h.i, 1); sel = null; push(); } return; }
  if (tool === 'peg') { def.pegs.push([x, y, 5.5, 0]); sel = { list: 'pegs', i: def.pegs.length - 1 }; push(); return; }
  if (tool === 'bumper') { def.pegs.push([x, y, 5.5, 1]); sel = { list: 'pegs', i: def.pegs.length - 1 }; push(); return; }
  if (tool === 'flum') { def.flum.push([x, y, 14]); sel = { list: 'flum', i: def.flum.length - 1 }; push(); return; }
  if (tool === 'spinner') { def.spinners.push({ x, y, len: 44, w: 4.5, om: 2.2 }); sel = { list: 'spinners', i: def.spinners.length - 1 }; push(); return; }
  drag = { kind: 'new', x, y, x2: x, y2: y };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const x = sn(wx(e)), y = sn(wy(e));
  if (drag.kind === 'new') { drag.x2 = x; drag.y2 = y; draw(); }
  else if (drag.kind === 'target') { const c = def.cannons[drag.s.i]; c.tx = x; c.ty = y; draw(); }
  else if (drag.kind === 'move') { drag.moved = true; moveItem(drag.s, x - drag.x, y - drag.y); draw(); }
});
window.addEventListener('mouseup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'move') { if (d.moved) push(); else showProps(); return; }
  if (d.kind === 'target') { push(); return; }
  const x0 = Math.min(d.x, d.x2), x1 = Math.max(d.x, d.x2), y0 = Math.min(d.y, d.y2), y1 = Math.max(d.y, d.y2);
  const len = Math.hypot(d.x2 - d.x, d.y2 - d.y);
  if (len < 6) { draw(); return; }
  if (tool === 'wall') { def.segs.push([d.x, d.y, d.x2, d.y2]); sel = { list: 'segs', i: def.segs.length - 1 }; }
  else if (tool === 'shelf') { def.shelves.push([d.x, d.y, d.x2, d.y2]); sel = { list: 'shelves', i: def.shelves.length - 1 }; }
  else if (tool === 'grid') { def.grids.push([d.x, d.y, d.x2, d.y2]); sel = { list: 'grids', i: def.grids.length - 1 }; }
  else if (tool === 'block') { def.blocks.push([x0, y0, x1, y1]); sel = { list: 'blocks', i: def.blocks.length - 1 }; }
  else if (tool === 'grate') { def.grates.push([x0, y0, x1, y1]); sel = { list: 'grates', i: def.grates.length - 1 }; }
  else if (tool === 'cup') { def.cups.push({ x0, y0, x1, y1 }); sel = { list: 'cups', i: def.cups.length - 1 }; }
  else if (tool === 'cannon') { const cx = (x0 + x1) / 2; def.cannons.push({ x0, y0, x1, y1, tx: cx < 150 ? 165 : 135, ty: 140, pw: 290 }); sel = { list: 'cannons', i: def.cannons.length - 1 }; }
  else if (tool === 'wind') { const cx = (x0 + x1) / 2; def.wind.push({ x0, y0, x1, y1, ax: cx < 150 ? -330 : 330, ay: -40 }); sel = { list: 'wind', i: def.wind.length - 1 }; }
  push();
});
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(-1); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); undo(1); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (sel) { def[sel.list].splice(sel.i, 1); sel = null; push(); } }
  else if (e.key === 'Escape') { tool = 'select'; sel = null; for (const x of tb.querySelectorAll('button')) x.classList.toggle('on', x.dataset.tool === 'select'); showProps(); draw(); }
  else if (sel && e.key.startsWith('Arrow')) {
    e.preventDefault(); const st = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
    sel.orig = clone(def[sel.list][sel.i]); moveItem(sel, dx, dy); push();
  }
});

/* ---------- Eigenschaften ---------- */
function showProps() {
  const p = $('props');
  if (!sel || !def[sel.list] || !def[sel.list][sel.i]) { sel = null; p.innerHTML = '<h2>Auswahl</h2><div class="small">Nichts ausgewählt. Wähle ein Werkzeug links oder klicke ein Teil an. Entf löscht, Pfeiltasten verschieben (mit Umschalt 10er-Schritte).</div>'; return; }
  const kd = KINDS[sel.list], it = def[sel.list][sel.i];
  p.innerHTML = '<h2>' + kd.name + '</h2>' + kd.f.map(f => '<label>' + f[0] + '<input type="number" step="any" data-k="' + f[1] + '" value="' + (it[f[1]] ?? 0) + '"></label>').join('') + '<div class="row" style="margin-top:6px"><button class="btn" id="del">Löschen</button></div>';
  for (const inp of p.querySelectorAll('input')) inp.onchange = () => { const k = isNaN(+inp.dataset.k) ? inp.dataset.k : +inp.dataset.k; it[k] = +inp.value; push(); };
  $('del').onclick = () => { def[sel.list].splice(sel.i, 1); sel = null; push(); };
}
function syncShape() { $('sh').value = def.shape.sh; $('half').value = def.shape.half; $('nm').value = def.id; }
$('sh').onchange = () => { def.shape.sh = Math.max(60, Math.min(372, +$('sh').value || 175)); push(); };
$('half').onchange = () => { def.shape.half = Math.max(14, Math.min(140, +$('half').value || 15)); push(); };
$('nm').onchange = () => { def.id = $('nm').value.trim().replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'meindropper'; push(); };
for (const b of document.querySelectorAll('[data-preset]')) b.onclick = () => { def = fill(clone(DEFS_DROPPER[b.dataset.preset])); def.id = b.dataset.preset + '_kopie'; sel = null; push(); };
$('clear').onclick = () => { if (confirm('Alles löschen?')) { def = EMPTY(); sel = null; push(); } };

/* ---------- Zeichnen ---------- */
function draw() {
  const L = layout();
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W0, H0); g.fillStyle = '#e9e5d4'; g.fillRect(0, 0, W0, H0);
  // Spielfeld
  g.beginPath(); L.poly.forEach((q, i) => { const X = sx(q[0]), Y = sy(Math.max(q[1], -OY)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fillStyle = '#fbf6e4'; g.fill();
  // Raster
  g.strokeStyle = 'rgba(29,39,66,.08)'; g.lineWidth = 1; for (let y = 0; y <= BH; y += 20) { g.beginPath(); g.moveTo(0, sy(y)); g.lineTo(W0, sy(y)); g.stroke(); } for (let x = 0; x <= BW; x += 20) { g.beginPath(); g.moveTo(sx(x), sy(-OY)); g.lineTo(sx(x), sy(BH)); g.stroke(); }
  // Ziel und Einschüttstelle
  g.fillStyle = 'rgba(255,212,90,.35)'; g.fillRect(sx(L.goal[0]), sy(L.goal[1]), L.goal[2] * K, L.goal[3] * K);
  g.fillStyle = '#2f8a3a'; g.font = '12px sans-serif'; g.fillText('Bälle kommen hier heraus', sx(100), sy(-OY + 14)); g.beginPath(); g.arc(sx(138), sy(-20), 10 * K * .5, 0, 7); g.strokeStyle = '#2f8a3a'; g.stroke();
  g.fillStyle = '#c93030'; g.fillText('Ausgang (Gewinn)', sx(112), sy(EXIT_Y) + 12);
  g.strokeStyle = '#c93030'; g.beginPath(); g.moveTo(0, sy(EXIT_Y)); g.lineTo(W0, sy(EXIT_Y)); g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);
  // Wände der Grundform
  g.strokeStyle = '#1d2742'; g.lineWidth = 3; g.lineCap = 'round';
  for (const ln of L.outline) { g.beginPath(); ln.forEach((q, i) => { const X = sx(q[0]), Y = sy(Math.max(q[1], -OY)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
  const line = (a, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(sx(a[0]), sy(a[1])); g.lineTo(sx(a[2]), sy(a[3])); g.stroke(); };
  const rect = (x0, y0, x1, y1, fill, stroke) => { g.fillStyle = fill; g.fillRect(sx(x0), sy(y0), (x1 - x0) * K, (y1 - y0) * K); g.strokeStyle = stroke; g.lineWidth = 2; g.strokeRect(sx(x0), sy(y0), (x1 - x0) * K, (y1 - y0) * K); };
  for (const r of def.grates) { rect(r[0], r[1], r[2], r[3], '#3b3a46', '#1d2742'); g.strokeStyle = '#9a98a8'; g.lineWidth = 1.5; for (let x = r[0] + 6; x < r[2]; x += 10) { g.beginPath(); g.moveTo(sx(x), sy(r[1])); g.lineTo(sx(x), sy(r[3])); g.stroke(); } }
  for (const r of def.blocks) rect(r[0], r[1], r[2], r[3], '#e8d9a8', '#1d2742');
  for (const c of def.cups) { rect(c.x0, c.y0, c.x1, c.y1, 'rgba(201,139,58,.45)', '#7a4a21'); g.fillStyle = '#7a4a21'; g.font = '11px sans-serif'; g.fillText('Korb', sx(c.x0 + 3), sy(c.y0 + 12)); }
  for (const w of def.wind) { rect(w.x0, w.y0, w.x1, w.y1, 'rgba(80,150,220,.25)', '#4a96d8'); const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2, l = Math.hypot(w.ax, w.ay) || 1; arrow(cx, cy, cx + w.ax / l * 18, cy + w.ay / l * 18, '#2f6fb0'); }
  for (const c of def.cannons) { rect(c.x0, c.y0, c.x1, c.y1, 'rgba(110,118,134,.45)', '#4b5160'); const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; arrow(cx, cy, c.tx, c.ty, '#6b7180', true); g.beginPath(); g.arc(sx(c.tx), sy(c.ty), 5, 0, 7); g.fillStyle = '#e8453c'; g.fill(); }
  for (const a of def.grids) { line(a, '#1d2742', 5); line(a, '#c7d3ea', 2); }
  for (const a of def.shelves) { line(a, '#1d2742', 7); line(a, '#d9a441', 4); }
  for (const a of def.segs) line(a, '#1d2742', 4);
  for (const sp of def.spinners) { g.strokeStyle = '#1d2742'; g.lineWidth = sp.w * 2 * K + 2; g.beginPath(); g.moveTo(sx(sp.x - sp.len), sy(sp.y)); g.lineTo(sx(sp.x + sp.len), sy(sp.y)); g.stroke(); g.strokeStyle = '#ffd45a'; g.lineWidth = sp.w * 2 * K - 2; g.beginPath(); g.moveTo(sx(sp.x - sp.len), sy(sp.y)); g.lineTo(sx(sp.x), sy(sp.y)); g.stroke(); g.strokeStyle = '#4fa3e8'; g.beginPath(); g.moveTo(sx(sp.x), sy(sp.y)); g.lineTo(sx(sp.x + sp.len), sy(sp.y)); g.stroke(); g.beginPath(); g.arc(sx(sp.x), sy(sp.y), 7 * K * .6, 0, 7); g.fillStyle = '#e0533a'; g.fill(); }
  for (const f of def.flum) { g.beginPath(); g.arc(sx(f[0]), sy(f[1]), f[2] * K, 0, 7); g.fillStyle = '#ff6fb0'; g.fill(); g.strokeStyle = '#1d2742'; g.lineWidth = 2; g.stroke(); }
  for (const p of def.pegs) { g.beginPath(); g.arc(sx(p[0]), sy(p[1]), p[2] * K, 0, 7); g.fillStyle = p[3] ? '#e0533a' : '#c9b88a'; g.fill(); g.strokeStyle = '#1d2742'; g.lineWidth = 2; g.stroke(); }
  // hängengebliebene Bälle aus der Statistik
  g.fillStyle = 'rgba(220,40,40,.55)'; for (const s of stuck) { g.beginPath(); g.arc(sx(s[0]), sy(s[1]), 4, 0, 7); g.fill(); }
  // Auswahl
  if (sel && def[sel.list] && def[sel.list][sel.i]) { const b = bounds(sel); g.strokeStyle = '#ff7a00'; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(sx(b[0]) - 4, sy(b[1]) - 4, (b[2] - b[0]) * K + 8, (b[3] - b[1]) * K + 8); g.setLineDash([]); }
  // Zieh-Vorschau
  if (drag && drag.kind === 'new') { g.strokeStyle = '#ff7a00'; g.lineWidth = 2; g.setLineDash([4, 3]); if (['wall', 'shelf', 'grid'].includes(tool)) { g.beginPath(); g.moveTo(sx(drag.x), sy(drag.y)); g.lineTo(sx(drag.x2), sy(drag.y2)); g.stroke(); } else g.strokeRect(sx(Math.min(drag.x, drag.x2)), sy(Math.min(drag.y, drag.y2)), Math.abs(drag.x2 - drag.x) * K, Math.abs(drag.y2 - drag.y) * K); g.setLineDash([]); }
  // Größenvergleich: ein Ball
  g.beginPath(); g.arc(sx(BW - 20), sy(-OY + 20), BR * K, 0, 7); g.strokeStyle = '#555'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#555'; g.font = '10px sans-serif'; g.fillText('Ball', sx(BW - 28), sy(-OY + 20) + 3);
}
function arrow(x0, y0, x1, y1, col, dashed) { g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(dashed ? [4, 4] : []); g.beginPath(); g.moveTo(sx(x0), sy(y0)); g.lineTo(sx(x1), sy(y1)); g.stroke(); g.setLineDash([]); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(sx(x1), sy(y1)); g.lineTo(sx(x1) - Math.cos(a - .4) * 9, sy(y1) - Math.sin(a - .4) * 9); g.moveTo(sx(x1), sy(y1)); g.lineTo(sx(x1) - Math.cos(a + .4) * 9, sy(y1) - Math.sin(a + .4) * 9); g.stroke(); }
function bounds(s) {
  const kd = KINDS[s.list], it = def[s.list][s.i];
  if (kd.t === 'pt') return [it[0] - it[2], it[1] - it[2], it[0] + it[2], it[1] + it[2]];
  if (kd.t === 'sp') return [it.x - it.len, it.y - it.w, it.x + it.len, it.y + it.w];
  if (kd.t === 'ln' || kd.t === 'rc') return [Math.min(it[0], it[2]), Math.min(it[1], it[3]), Math.max(it[0], it[2]), Math.max(it[1], it[3])];
  return [it.x0, it.y0, it.x1, it.y1];
}

/* ---------- Export / Import ---------- */
function exportText() {
  const d = Object.assign({}, def); for (const k of Object.keys(d)) if (Array.isArray(d[k]) && !d[k].length) delete d[k];
  const lines = Object.entries(d).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v));
  return '{\n  "format": "dropper-v1",\n  "def": {\n' + lines.join(',\n') + '\n  }\n}';
}
function msg(t) { const m = $('msg'); m.textContent = t; m.style.display = 'block'; clearTimeout(msg.t); msg.t = setTimeout(() => { m.style.display = 'none'; }, 2200); }
$('copy').onclick = () => { $('json').select(); try { navigator.clipboard.writeText($('json').value); } catch (e) { document.execCommand('copy'); } msg('Kopiert.'); };
$('save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('json').value], { type: 'application/json' })); a.download = 'dropper-' + def.id + '.json'; a.click(); };
$('load').onclick = () => { try { const o = JSON.parse($('json').value); def = fill(o.def || o); sel = null; push(); msg('Geladen.'); } catch (e) { msg('Das ist kein gültiges JSON.'); } };

/* ---------- Statistik ---------- */
$('runstats').onclick = () => {
  const L = layout(), N = 150, out = $('stats'); let i = 0, ok = 0, reached = 0, tsum = 0, tmax = 0, slow = 0, outs = 0; const win = new Array(10).fill(0); stuck = [];
  out.innerHTML = 'Rechne ...';
  const chunk = () => {
    for (let n = 0; n < 6 && i < N; n++, i++) {
      const s = createBox((i + 1) * 7919, 10, L); let guard = 120 * 19; while (!s.done && guard-- > 0) stepBox(s);
      reached += s.reached || 0; if ((s.reached || 0) > 0) { ok++; tsum += s.times[0]; tmax = Math.max(tmax, s.times[0]); if (s.times[0] > 14) slow++; win[s.order[0]]++; }
      for (const b of s.balls) { if (b.out) outs++; else if (!b.done) stuck.push([b.x, b.y]); }
    }
    if (i < N) { out.textContent = 'Rechne ... ' + i + '/' + N; draw(); setTimeout(chunk, 0); return; }
    draw();
    out.innerHTML = '<pre>' + [
      'Mindestens ein Ball unten: ' + ok + ' von ' + N + ' (' + Math.round(ok / N * 100) + ' %)',
      'Ø Bälle unten pro Lauf: ' + (reached / N).toFixed(1) + ' von 10',
      'Ø erste Ankunft: ' + (ok ? (tsum / ok).toFixed(1) : '-') + ' s, längste ' + tmax.toFixed(1) + ' s, über 14 s: ' + slow,
      'Bälle in Gittern/Körben: ' + (outs / N).toFixed(1) + ' pro Lauf',
      'Bälle hängen geblieben: ' + stuck.length + ' (rote Punkte im Bild)',
      'Gewinner nach Startplatz: ' + win.join(' ')
    ].join('\n') + '</pre><div class="small">Gut ist: fast immer ein Ball unten, erste Ankunft unter ca. 12 s, kaum hängen gebliebene Bälle und eine gleichmäßige Gewinnerverteilung.</div>';
  };
  setTimeout(chunk, 0);
};

/* ---------- Vorschau wie im Spiel ---------- */
const pv = $('pv'), pg = pv.getContext('2d'), DPR = Math.min(2, window.devicePixelRatio || 1);
let ps = null, pcands = [], pL = null, pt0 = 0, pacc = 0, plast = 0, prun = false;
function startPreview() {
  clearBoardCache(); pL = layout();
  const seed = Math.max(1, Math.floor(+$('seed').value || 1)); ps = createBox(seed, 10, pL);
  const r = mulberry(seed); pcands = []; for (let i = 0; i < 10; i++) pcands.push(BALL_IDS[Math.floor(r() * BALL_IDS.length)]);
  pacc = 0; plast = 0; pt0 = performance.now() / 1000; pend = 0;
  const Wd = 300, Hd = Math.round(Wd / (BW + 16) * BOX_H); pv.width = Wd * DPR; pv.height = Hd * DPR; pv.style.width = Wd + 'px'; pv.style.height = Hd + 'px';
  if (!prun) { prun = true; requestAnimationFrame(pframe); }
}
let pend = 0;
function pframe(ms) {
  if (!$('preview').classList.contains('show')) { prun = false; return; }
  requestAnimationFrame(pframe);
  const tm = ms / 1000, dt = Math.min(.05, plast ? tm - plast : .016); plast = tm;
  pacc += dt * 120 * (+$('pspd').value || 1);
  while (pacc >= 1 && !ps.done && ps.order.length < 3) { stepBox(ps); pacc--; }
  if ((ps.order.length >= 3 || ps.done) && !pend) pend = tm;
  const Wd = 300; pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, pv.width, pv.height); pg.scale(DPR, DPR);
  drawBox(pg, Wd, ps, pcands, tm, Math.floor(tm * 7) % 3, ps.order.length ? ps.order[0] : -1, '#d9a441', 'standard');
  $('pinfo').textContent = 'Zeit: ' + ps.t.toFixed(1) + ' s' + (ps.order.length ? ' | erster Ball unten nach ' + ps.times[0].toFixed(1) + ' s (Platz ' + (ps.order[0] + 1) + ')' : '') + (ps.done && !(ps.reached > 0) ? ' | KEIN Ball kam unten an' : '');
}
$('runprev').onclick = () => { $('preview').classList.add('show'); startPreview(); };
$('pclose').onclick = () => $('preview').classList.remove('show');
$('pre').onclick = startPreview; $('pnew').onclick = () => { $('seed').value = 1 + Math.floor(Math.random() * 99999); startPreview(); };

/* ---------- Start ---------- */
push();
