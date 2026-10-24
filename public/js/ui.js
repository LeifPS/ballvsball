// Oberfläche: Anmeldung, Startseite, Sammlung, Ballbox, Markt, Handel, Freunde, Kampfablauf.
import { DEFS, BALL_IDS, RARITY, DT, BOX, createSim, stepSim } from './engine.js';
import { createBox, stepBox, BW } from './boxsim.js';
import { DPR, INK, setTarget, frameSet, mkSprite, marker, spr, line, poly, T, drawText, mulberry } from './pen.js';
import { drawBallIn, bodySprite, SPARK, STAR, COIN, HEART, HEART0, SWORD, CROWN, LOCK, CHECK, CROSS, ARROW, PLUS, SKIP, BOXART, clearFx, R0 } from './art.js';
import { drawArena, drawHud, drawBox, drawFrame, BOX_H, TEAM_COL } from './render.js';

const $ = s => document.querySelector(s);
const SCREEN = $('#screen'), OVER = $('#overlay'), TOAST = $('#toast');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  token: null, me: null, ws: null, wsOK: false, wsQueue: [], screen: '', match: null, view: null,
  filter: 'all', mk: { tab: 'buy', rarity: '', q: '', sort: 'low', page: 0, items: [], total: 0 },
  tr: { tab: 'in' }, tnew: { name: '', player: null, give: new Set(), want: new Set() }, room: null, timers: [], kicked: false
};
let store = null;
try { store = window.localStorage; } catch (e) { store = null; }
const mem = {};
const lget = k => { try { return store ? store.getItem(k) : mem[k]; } catch (e) { return mem[k]; } };
const lset = (k, v) => { try { if (store) store.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } };

const ERR = {
  net: 'Keine Verbindung zum Server.', auth: 'Anmeldung fehlgeschlagen.', need_name: 'Bitte wähle einen Namen.',
  name_invalid: 'Name: 3 bis 16 Zeichen, nur Buchstaben, Zahlen, Leerzeichen, - und _.', name_taken: 'Dieser Name ist schon vergeben.',
  daily_taken: 'Heute schon abgeholt.', no_coins: 'Nicht genug Münzen.', price_invalid: 'Der Preis muss zwischen 10 und 100000 Münzen liegen.',
  not_yours: 'Das gehört dir nicht (mehr).', locked: 'Dieser Ball ist gerade gesperrt.', min_balls: 'Du musst mindestens 3 freie Bälle behalten.',
  gone: 'Das gibt es nicht mehr.', own: 'Das ist dein eigener Ball.', no_player: 'Spieler nicht gefunden.', self: 'Das bist du selbst.',
  empty: 'Das Angebot ist leer.', not_theirs: 'Der Ball gehört dem anderen nicht mehr.', too_many: 'Zu viele offene Angebote.',
  their_coins: 'Der andere hat nicht genug Münzen.', their_min: 'Der andere müsste zu wenig Bälle behalten.',
  room_unknown: 'Raum nicht gefunden.', room_full: 'Raum ist voll.', box_unknown: 'Unbekannte Box.', bad: 'Ungültige Anfrage.'
};
const errText = c => ERR[c] || 'Etwas ist schiefgegangen (' + c + ').';

/* ================= Zeichen-Infrastruktur ================= */
const KIND = {
  btn: ['#ffe08a', '#f2b64a', 2.9], btn2: ['#fffdf6', null, 2.6], btnr: ['#ffc9c0', '#e88a7a', 2.6], card: ['#fffaf0', null, 2.7],
  panel: ['#fffdf6', null, 3], pill: ['#fffdf6', null, 2], inp: ['#ffffff', null, 2.2], tab: ['#fffdf6', null, 2.2], tabon: ['#ffe08a', '#f2b64a', 2.4],
  toast: ['#fff1c2', null, 2.6]
};
const FR = new Set(), BALLS = new Set(), ICOS = new Set();
const ICON = { coin: COIN, heart: HEART, heart0: HEART0, sword: SWORD, star: STAR, crown: CROWN, lock: LOCK, check: CHECK, cross: CROSS, arrow: ARROW, plus: PLUS, skip: SKIP };
const stripCache = new Map();
function strip(w, col) {
  const k = Math.round(w) + col; let s = stripCache.get(k);
  if (!s) { s = mkSprite(950 + stripCache.size, Math.round(w) + 10, 18, 5, 9, Z => marker(Z, 0, 8, Math.round(w), 8, 7, col)); stripCache.set(k, s); }
  return s;
}
function ico(name, size) { return '<canvas class="ico" data-ico="' + name + '" data-size="' + (size || 22) + '"></canvas>'; }
const coinHTML = n => '<span class="coinrow"><b>' + n + '</b>' + ico('coin', 22) + '</span>';
const rarHTML = r => '<span class="rar" style="color:' + RARITY[r].color + '">' + RARITY[r].name + '</span>';

function decorate(root) {
  root.querySelectorAll('[data-fr]').forEach(el => {
    if (el._fr) return;
    const cv = document.createElement('canvas'); cv.className = 'fr'; el.insertBefore(cv, el.firstChild); el._fr = cv; FR.add(el);
  });
  root.querySelectorAll('canvas.ball').forEach(cv => {
    if (cv._init) return; cv._init = 1;
    const s = +cv.dataset.size || 80; cv.width = s * DPR; cv.height = s * DPR; cv.style.width = s + 'px'; cv.style.height = s + 'px';
    BALLS.add(cv);
  });
  root.querySelectorAll('canvas.ico').forEach(cv => {
    if (cv._init) return; cv._init = 1;
    const s = +cv.dataset.size || 22; cv.width = s * DPR; cv.height = s * DPR; cv.style.width = s + 'px'; cv.style.height = s + 'px';
    ICOS.add(cv);
  });
  drawStatic(performance.now() / 1000, true);
}
let lastTf = -1, lastB = -1;
function drawFrames(tf) {
  for (const el of FR) {
    if (!el.isConnected) { FR.delete(el); continue; }
    const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) continue;
    const kd = KIND[el.dataset.fr] || KIND.card;
    const fs = frameSet(el.dataset.fr, w, h, kd[0], kd[1], kd[2]);
    const cv = el._fr, M = fs.M;
    const pw = Math.ceil(fs.w * DPR), ph = Math.ceil(fs.h * DPR);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.width = fs.w + 'px'; cv.style.height = fs.h + 'px'; cv.style.left = -M + 'px'; cv.style.top = -M + 'px'; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
    ctx.drawImage(fs.fr[tf], 0, 0, fs.w, fs.h);
    if (el.dataset.strip) {
      const sp = strip(w - 28, el.dataset.strip), old = setTarget(ctx);
      spr(sp, M + 14, M + 10, tf, 1); setTarget(old);
    }
  }
  for (const cv of ICOS) {
    if (!cv.isConnected) { ICOS.delete(cv); continue; }
    const ctx = cv.getContext('2d'), s = +cv.dataset.size || 22, old = setTarget(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
    const sp = ICON[cv.dataset.ico]();
    spr(sp, s / 2, s / 2, tf, s / 26); setTarget(old);
  }
}
function drawBalls(tm, tf) {
  for (const cv of BALLS) {
    if (!cv.isConnected) { BALLS.delete(cv); continue; }
    const ctx = cv.getContext('2d'), s = +cv.dataset.size || 80;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
    drawBallIn(ctx, cv.dataset.ball, s, tm, tf, +cv.dataset.fit || .55);
  }
}
function drawStatic(tm, force) {
  const tf = Math.floor(tm * 7) % 3;
  drawFrames(tf); drawBalls(tm, tf);
}
let lastT = 0;
function loop(ms) {
  requestAnimationFrame(loop);
  const tm = ms / 1000, dt = Math.min(.1, tm - lastT || .016); lastT = tm;
  const tf = Math.floor(tm * 7) % 3; T.f = tf;
  if (tf !== lastTf) { lastTf = tf; drawFrames(tf); }
  const b = Math.floor(tm * 14);
  if (b !== lastB) { lastB = b; drawBalls(tm, tf); }
  if (S.view && S.view.frame) S.view.frame(tm, dt, tf);
}

/* ================= Hilfen ================= */
function show(html) {
  clearTimers();
  SCREEN.innerHTML = html; window.scrollTo(0, 0);
  decorate(SCREEN);
}
function setView(v) { if (S.view && S.view.stop) S.view.stop(); S.view = v; }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }
function every(fn, ms) { const id = setInterval(fn, ms); S.timers.push(id); return id; }
function overlay(html) { OVER.innerHTML = '<div>' + html + '</div>'; OVER.hidden = false; OVER.scrollTop = 0; decorate(OVER); }
function closeOverlay() { OVER.hidden = true; OVER.innerHTML = ''; }
let toastT = 0;
function toast(msg) {
  TOAST.innerHTML = ''; TOAST.dataset.fr = 'toast';
  const cv = document.createElement('canvas'); cv.className = 'fr'; TOAST.appendChild(cv); TOAST._fr = cv; FR.add(TOAST);
  const sp = document.createElement('span'); sp.textContent = msg; TOAST.appendChild(sp);
  TOAST.hidden = false; drawStatic(performance.now() / 1000);
  clearTimeout(toastT); toastT = setTimeout(() => { TOAST.hidden = true; }, 2800);
}
async function api(path, body) {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': S.token }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (j.me) S.me = j.me;
    return j;
  } catch (e) { return { err: 'net' }; }
}
function ballName(t) { return DEFS[t] ? DEFS[t].name : '?'; }
const SORT = ['gewoehnlich', 'selten', 'episch', 'legendaer'];
function typeCounts() {
  const c = {};
  for (const b of S.me.balls) { c[b.type] = c[b.type] || { n: 0, free: 0, list: [] }; c[b.type].n++; if (!b.lock) c[b.type].free++; c[b.type].list.push(b); }
  return c;
}
function topType() {
  let best = null, bo = -1;
  for (const b of S.me.balls) { const o = RARITY[DEFS[b.type].rarity].order; if (o > bo) { bo = o; best = b.type; } }
  return best || 'stachel';
}
function topBar() {
  return '<div class="row sb"><div class="pill" data-fr="pill"><span>' + esc(S.me.name) + '</span></div><div class="pill" data-fr="pill">' + coinHTML(S.me.coins) + '</div></div>';
}
function backBar(title, to) {
  return '<div class="row"><button class="btn2 pill" data-fr="btn2" data-act="' + (to || 'home') + '" style="padding:6px 14px">' + ico('arrow', 26) + '</button><h2 class="grow jit">' + esc(title) + '</h2><div class="pill" data-fr="pill">' + coinHTML(S.me.coins) + '</div></div>';
}
function btn(label, act, extra, kind) {
  return '<button class="btn" data-fr="' + (kind || 'btn') + '" data-act="' + act + '" ' + (extra || '') + '><span>' + label + '</span></button>';
}

/* ================= Anmeldung ================= */
async function boot() {
  try { await document.fonts.load('18px Hand'); } catch (e) { }
  // Papier-Körnung
  try {
    const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'), R = mulberry(5);
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 200, 200);
    for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(120,96,60,' + (.03 + R() * .05) + ')'; x.fillRect(R() * 200, R() * 200, 1 + R() * 2, 1 + R() * 2); }
    document.body.style.backgroundImage = 'url(' + c.toDataURL() + ')';
  } catch (e) { }
  requestAnimationFrame(loop);
  S.token = lget('bvb_token');
  if (!S.token) { S.token = crypto.randomUUID() + crypto.randomUUID(); lset('bvb_token', S.token); }
  const r = await api('/api/login', {});
  if (r.err === 'need_name') return nameScreen('');
  if (r.err) return netError(r.err);
  connectWS(); home();
}
function netError(c) {
  show('<div class="col center"><h1>Ball gegen Ball</h1><p>' + esc(errText(c)) + '</p>' + btn('Nochmal versuchen', 'reload') + '</div>');
}
function nameScreen(err) {
  show('<div class="col"><h1 class="jit">Ball gegen Ball</h1><p class="center">Sammle Bälle und kämpfe gegen andere. Wie willst du heißen?</p>' +
    '<div class="inp" data-fr="inp"><input id="nm" maxlength="16" placeholder="Dein Name" autocomplete="off"></div><div class="err center" id="err">' + esc(err) + '</div>' +
    btn('Los geht\'s', 'register') + '<p class="small mute center">Dein Gerät merkt sich dein Konto. 3 bis 16 Zeichen.</p></div>');
}

/* ================= Verbindung ================= */
function connectWS() {
  if (S.kicked) return;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws';
  let ws;
  try { ws = new WebSocket(url); } catch (e) { setTimeout(connectWS, 3000); return; }
  S.ws = ws; S.wsOK = false;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token: S.token }));
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => { S.wsOK = false; if (S.ws === ws) { setTimeout(connectWS, 2000); if (['queue', 'room'].includes(S.screen)) { S.screen = ''; home(); toast('Verbindung verloren.'); } } };
  ws.onerror = () => { };
  clearInterval(S.pingT); S.pingT = setInterval(() => { if (S.wsOK) wsSend({ t: 'ping' }); }, 25000);
}
function wsSend(o) {
  if (S.wsOK && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o));
  else toast('Verbinde mit dem Server ...');
}
function onMsg(m) {
  switch (m.t) {
    case 'hello':
      if (m.ok) S.wsOK = true; else toast('Server-Anmeldung fehlgeschlagen.');
      break;
    case 'kicked': S.kicked = true; show('<div class="col center"><h1>Ball gegen Ball</h1><p>Dein Konto wurde auf einem anderen Gerät oder Tab geöffnet.</p>' + btn('Hier weiterspielen', 'reload') + '</div>'); break;
    case 'error': toast(errText(m.code)); break;
    case 'queued': if (S.screen !== 'queue') queueScreen(m); else queueUpdate(m); break;
    case 'unqueued': home(); break;
    case 'room': S.room = m; roomScreen(); break;
    case 'room_left': S.room = null; friends(); break;
    case 'match_start': S.match = { players: m.players, you: m.you, n: m.n, mode: m.mode, lives: m.lives, friendly: m.friendly, round: 0 }; if (m.resume) toast('Wieder verbunden.'); else matchIntro(); break;
    case 'pick_phase': pickScreen(m); break;
    case 'picked': break;
    case 'reveal': dirScreen(m); break;
    case 'dir_ok': break;
    case 'fight': fightScreen(m); break;
    case 'match_end': matchEnd(m); break;
    case 'left': S.match = null; home(); break;
  }
}

/* ================= Startseite ================= */
function home() {
  S.screen = 'home'; setView(null); closeOverlay();
  const me = S.me, tot = me.balls.length, types = new Set(me.balls.map(b => b.type)).size;
  show('<div class="col">' + topBar() +
    '<h1 class="jit">Ball gegen Ball</h1>' +
    '<div class="hero"><canvas class="ball" data-ball="' + topType() + '" data-size="150" data-fit=".62"></canvas></div>' +
    '<div class="stat">' + me.wins + ' Siege, ' + me.losses + ' Niederlagen - ' + types + ' von ' + BALL_IDS.length + ' Bällen gesammelt</div>' +
    btn('Kampf (1 gegen 1)', 'queue1') + btn('Team-Kampf (2 gegen 2)', 'queue2', '', 'btn') + btn('Mit Freunden spielen', 'friends', '', 'btn2') +
    '<div class="row gap6">' + '<div class="grow">' + btn('Sammlung', 'collection', '', 'btn2') + '</div><div class="grow">' + btn('Ballbox', 'box', '', 'btn2') + '</div></div>' +
    '<div class="row gap6">' + '<div class="grow">' + btn('Markt', 'market', '', 'btn2') + '</div><div class="grow">' + btn('Tauschen', 'trades', '', 'btn2') + '</div></div>' +
    (me.dailyReady ? btn('Tagesbelohnung abholen', 'daily') : '<p class="center mute small">Tagesbelohnung schon geholt. Morgen gibt es mehr.</p>') +
    '<p class="center small"><button data-act="rename" class="mute" style="text-decoration:underline">Name ändern</button></p></div>');
}

/* ================= Sammlung ================= */
function collection() {
  S.screen = 'collection'; setView(null);
  const c = typeCounts(), have = Object.keys(c).length;
  const tabs = [['all', 'Alle']].concat(SORT.map(r => [r, RARITY[r].name]));
  const ids = BALL_IDS.filter(id => S.filter === 'all' || DEFS[id].rarity === S.filter)
    .sort((a, b) => RARITY[DEFS[a].rarity].order - RARITY[DEFS[b].rarity].order);
  show('<div class="col">' + backBar('Sammlung') +
    '<p class="center small">' + have + ' von ' + BALL_IDS.length + ' verschiedenen Bällen - ' + S.me.balls.length + ' insgesamt</p>' +
    '<div class="tabs">' + tabs.map(t => '<button class="tab" data-fr="' + (S.filter === t[0] ? 'tabon' : 'tab') + '" data-act="filter" data-v="' + t[0] + '"><span>' + t[1] + '</span></button>').join('') + '</div>' +
    '<div class="grid3">' + ids.map(id => {
      const d = DEFS[id], o = c[id];
      return '<button class="card cell' + (o ? '' : ' locked') + '" data-fr="card" data-strip="' + RARITY[d.rarity].color + '" data-act="detail" data-t="' + id + '">' +
        (o && o.n > 1 ? '<span class="badge">x' + o.n + '</span>' : '') +
        '<div style="height:12px"></div><canvas class="ball" data-ball="' + id + '" data-size="84" data-fit=".6"></canvas><div class="nm">' + (o ? d.name : '???') + '</div></button>';
    }).join('') + '</div></div>');
}
function detail(type) {
  const d = DEFS[type], c = typeCounts()[type];
  const sugg = { gewoehnlich: 40, selten: 100, episch: 250, legendaer: 700 }[d.rarity];
  let own = '';
  if (c) {
    own = '<h3>Du besitzt ' + c.n + 'x</h3>' + c.list.map(b => {
      let r;
      if (b.lock === 1) r = '<span class="small">Auf dem Markt für ' + coinHTML(b.price) + '</span><button class="btn2 sm" data-fr="btn2" data-act="mkcancel" data-uid="' + b.uid + '"><span>Zurückziehen</span></button>';
      else if (b.lock === 2) r = '<span class="small">' + ico('lock', 20) + ' Im Tausch</span>';
      else r = '<div class="inp" data-fr="inp" style="width:90px"><input type="number" inputmode="numeric" min="10" id="pr' + b.uid + '" value="' + sugg + '"></div><button class="btn sm" data-fr="btn" data-act="mklist" data-uid="' + b.uid + '"><span>Verkaufen</span></button>';
      return '<div class="listrow card" data-fr="card"><span class="small grow">Ball Nr. ' + b.uid + '</span>' + r + '</div>';
    }).join('') + '<p class="small mute">Doppelte Bälle sind im Kampf nutzlos, aber du kannst sie verkaufen oder tauschen. Drei freie Bälle musst du immer behalten.</p>';
  } else own = '<p class="center mute">Diesen Ball hast du noch nicht. Öffne Ballboxen oder kaufe ihn auf dem Markt.</p>';
  overlay('<div class="col"><div class="row sb"><h2 class="jit">' + esc(d.name) + '</h2><button class="btn2 pill" data-fr="btn2" data-act="closeov" style="padding:6px 14px">' + ico('cross', 24) + '</button></div>' +
    '<div class="hero"><canvas class="ball" data-ball="' + type + '" data-size="220" data-fit=".66"></canvas></div>' +
    '<div class="row sb wrap">' + rarHTML(d.rarity) + '<span>' + ico('heart', 22) + ' <b>' + d.hp + '</b> Leben</span><span>' + ico('sword', 22) + ' Schaden: <b>' + d.dmg + '</b></span></div>' +
    '<div class="panel" data-fr="panel"><p>' + esc(d.desc) + '</p></div>' +
    '<div class="panel" data-fr="panel"><p><b>Stark gegen:</b> ' + esc(d.strong) + '</p><p class="mt"><b>Schwach gegen:</b> ' + esc(d.weak) + '</p></div>' + own + '</div>');
}

/* ================= Ballbox ================= */
function boxScreen() {
  S.screen = 'box'; setView(null);
  const p = S.me.boxPrice, ok = S.me.coins >= p;
  show('<div class="col">' + backBar('Ballbox') +
    '<div class="hero"><canvas id="bx" width="1" height="1"></canvas></div>' +
    '<div class="panel center" data-fr="panel"><h3>Standard-Box</h3><p class="mt">Zehn Bälle fallen in die Schüssel. Der erste, der durch die Öffnung rutscht, gehört dir.</p></div>' +
    '<div class="panel" data-fr="panel"><h3>Chancen</h3>' + SORT.map(r => '<div class="row sb"><span>' + rarHTML(r) + '</span><span>' + RARITY[r].weight + ' %</span></div>').join('') + '</div>' +
    btn('Öffnen für ' + p + ' Münzen', 'openbox', ok ? '' : 'disabled') + (ok ? '' : '<p class="center small mute">Dir fehlen Münzen. Gewinne Kämpfe oder hole die Tagesbelohnung.</p>') + '</div>');
  const cv = $('#bx'), w = 150, h = 130; cv.width = w * DPR; cv.height = h * DPR; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  S.view = {
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      const old = setTarget(ctx); spr(BOXART(), w / 2, h / 2 + 4 + Math.sin(tm * 2) * 2, tf, 1, Math.sin(tm * 1.5) * .04); setTarget(old);
    }
  };
}
async function openBox() {
  const before = new Set(S.me.balls.map(b => b.type));
  const r = await api('/api/box', { box: 'standard' });
  if (r.err) { toast(errText(r.err)); return; }
  S.screen = 'boxplay';
  const W = Math.min(window.innerWidth - 32, 340), H = Math.round(W / BW * (BOX_H));
  show('<div class="col"><h2 class="center jit">Los geht\'s!</h2><canvas id="bc" class="view"></canvas><p class="center small mute">Der erste Ball durch die Öffnung unten gehört dir.</p></div>');
  const cv = $('#bc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const s = createBox(r.seed, 10); let acc = 0, fin = 0, shown = false;
  S.view = {
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      acc += dt * 120;
      while (acc >= 1 && !s.done && s.order.length < 3) { stepBox(s); acc--; }
      if (s.order.length >= 3 || s.done) { if (!fin) fin = tm; }
      drawBox(ctx, W, s, r.cands, tm, tf, s.order.length ? s.order[0] : -1);
      if (fin && tm - fin > 1.6 && !shown) { shown = true; boxResult(r, s, before); }
    }
  };
}
function boxResult(r, s, before) {
  S.screen = 'boxres'; setView(null);
  const d = DEFS[r.ball.type], isNew = !before.has(r.ball.type);
  const near = s.order.slice(1, 3).map(i => r.cands[i]).filter(t => RARITY[DEFS[t].rarity].order > RARITY[d.rarity].order);
  const ok = S.me.coins >= S.me.boxPrice;
  show('<div class="col"><h1 class="jit">' + esc(d.name) + '!</h1><div class="center">' + rarHTML(d.rarity) + (isNew ? ' - <b>Neu in deiner Sammlung!</b>' : ' - Du hast ihn schon (Duplikat)') + '</div>' +
    '<div class="hero"><canvas class="ball" data-ball="' + r.ball.type + '" data-size="230" data-fit=".66"></canvas></div>' +
    '<div class="panel" data-fr="panel"><div class="row sb wrap"><span>' + ico('heart', 22) + ' <b>' + d.hp + '</b> Leben</span><span>' + ico('sword', 22) + ' Schaden: <b>' + d.dmg + '</b></span></div><p class="mt">' + esc(d.desc) + '</p></div>' +
    (near.length ? '<p class="center">Knapp daneben: ' + near.map(t => '<b style="color:' + RARITY[DEFS[t].rarity].color + '">' + esc(ballName(t)) + '</b>').join(' und ') + ' lag auch vorn!</p>' : '') +
    btn('Noch eine Box (' + S.me.boxPrice + ' Münzen)', 'openbox', ok ? '' : 'disabled') + btn('Zurück', 'home', '', 'btn2') + '</div>');
}

/* ================= Markt ================= */
async function market(resetPage) {
  S.screen = 'market'; setView(null);
  const mk = S.mk;
  if (resetPage) mk.page = 0;
  let body = '';
  if (mk.tab === 'buy') {
    const r = await api('/api/market/browse', { rarity: mk.rarity, q: mk.q, sort: mk.sort, page: mk.page });
    if (r.err) { toast(errText(r.err)); return; }
    mk.items = r.items; mk.total = r.total;
    body = '<div class="row gap6 wrap">' + [['', 'Alle']].concat(SORT.map(x => [x, RARITY[x].name])).map(t => '<button class="tab" data-fr="' + (mk.rarity === t[0] ? 'tabon' : 'tab') + '" data-act="mkrar" data-v="' + t[0] + '"><span>' + t[1] + '</span></button>').join('') + '</div>' +
      '<div class="row gap6"><div class="inp grow" data-fr="inp"><input id="mkq" placeholder="Ball suchen" value="' + esc(mk.q) + '"></div><button class="btn sm" data-fr="btn" data-act="mksearch"><span>Suchen</span></button></div>' +
      '<div class="row gap6">' + [['low', 'Billigste'], ['high', 'Teuerste'], ['new', 'Neueste']].map(t => '<button class="tab" data-fr="' + (mk.sort === t[0] ? 'tabon' : 'tab') + '" data-act="mksort" data-v="' + t[0] + '"><span>' + t[1] + '</span></button>').join('') + '</div>' +
      (mk.items.length ? mk.items.map(it => {
        const d = DEFS[it.type];
        return '<div class="listrow card" data-fr="card" data-strip="' + RARITY[d.rarity].color + '"><div style="height:8px;width:0"></div><canvas class="ball" data-ball="' + it.type + '" data-size="56" data-fit=".7"></canvas><div class="grow"><b>' + esc(d.name) + '</b><br><span class="small mute">von ' + esc(it.seller) + '</span></div>' +
          (it.mine ? '<span class="small">dein Angebot</span>' : '<button class="btn sm" data-fr="btn" data-act="mkbuy" data-uid="' + it.uid + '" data-price="' + it.price + '"><span>' + coinHTML(it.price) + '</span></button>') + '</div>';
      }).join('') : '<p class="center mute">Gerade keine Angebote.</p>') +
      '<div class="row sb">' + (mk.page > 0 ? '<button class="btn2 sm btn" data-fr="btn2" data-act="mkprev"><span>Zurück</span></button>' : '<span></span>') + (mk.total > (mk.page + 1) * 40 ? '<button class="btn2 sm btn" data-fr="btn2" data-act="mknext"><span>Weiter</span></button>' : '<span></span>') + '</div>';
  } else {
    const mine = S.me.balls.filter(b => b.lock === 1);
    body = mine.length ? mine.map(b => {
      const d = DEFS[b.type];
      return '<div class="listrow card" data-fr="card" data-strip="' + RARITY[d.rarity].color + '"><div style="height:8px;width:0"></div><canvas class="ball" data-ball="' + b.type + '" data-size="56" data-fit=".7"></canvas><div class="grow"><b>' + esc(d.name) + '</b><br>' + coinHTML(b.price) + '</div><button class="btn2 sm btn" data-fr="btn2" data-act="mkcancel" data-uid="' + b.uid + '" data-back="market"><span>Zurückziehen</span></button></div>';
    }).join('') : '<p class="center mute">Du hast nichts zum Verkauf angeboten. Öffne in der Sammlung einen Ball, den du doppelt hast, und lege einen Preis fest.</p>';
  }
  show('<div class="col">' + backBar('Markt') + '<div class="row gap6"><button class="tab" data-fr="' + (mk.tab === 'buy' ? 'tabon' : 'tab') + '" data-act="mktab" data-v="buy"><span>Kaufen</span></button><button class="tab" data-fr="' + (mk.tab === 'mine' ? 'tabon' : 'tab') + '" data-act="mktab" data-v="mine"><span>Meine Angebote</span></button></div>' + body + '<p class="small mute center">Beim Verkauf werden 5 % Gebühr abgezogen.</p></div>');
}

/* ================= Tauschen ================= */
async function trades() {
  S.screen = 'trades'; setView(null);
  const tab = S.tr.tab;
  let body = '';
  if (tab === 'new') {
    const t = S.tnew, myFree = S.me.balls.filter(b => !b.lock);
    const chip = (b, set, act) => '<button class="tab" data-fr="' + (set.has(b.uid) ? 'tabon' : 'tab') + '" data-act="' + act + '" data-uid="' + b.uid + '"><span>' + esc(ballName(b.type)) + '</span></button>';
    body = '<div class="row gap6"><div class="inp grow" data-fr="inp"><input id="tname" placeholder="Spielername" value="' + esc(t.name) + '"></div><button class="btn sm" data-fr="btn" data-act="tfind"><span>Suchen</span></button></div>' +
      '<div class="err" id="err"></div>' +
      (t.player ? '<h3>Du gibst</h3><div class="row gap6 wrap">' + (myFree.map(b => chip(b, t.give, 'tgive')).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6"><span>und</span><div class="inp" data-fr="inp" style="width:100px"><input id="cgive" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + ico('coin', 22) + '</div>' +
        '<h3>Du willst von ' + esc(t.player.name) + '</h3><div class="row gap6 wrap">' + (t.player.balls.map(b => chip(b, t.want, 'twant')).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6"><span>und</span><div class="inp" data-fr="inp" style="width:100px"><input id="cwant" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + ico('coin', 22) + '</div>' +
        btn('Angebot senden', 'tsend') : '<p class="mute center">Suche einen Spieler über seinen Namen.</p>');
  } else {
    const r = await api('/api/trades');
    if (r.err) { toast(errText(r.err)); return; }
    const list = tab === 'in' ? r.incoming : tab === 'out' ? r.outgoing : r.history;
    const bl = a => a.length ? a.map(b => esc(b.type ? ballName(b.type) : '?')).join(', ') : '-';
    body = list.length ? list.map(t => {
      const other = t.mine ? t.to : t.from;
      let acts = '';
      if (tab === 'in') acts = '<div class="row gap6"><button class="btn sm" data-fr="btn" data-act="tans" data-id="' + t.id + '" data-a="accept"><span>Annehmen</span></button><button class="btn2 sm btn" data-fr="btnr" data-act="tans" data-id="' + t.id + '" data-a="decline"><span>Ablehnen</span></button></div>';
      else if (tab === 'out') acts = '<button class="btn2 sm btn" data-fr="btn2" data-act="tans" data-id="' + t.id + '" data-a="cancel"><span>Zurückziehen</span></button>';
      const you = t.mine ? t.give : t.want, they = t.mine ? t.want : t.give, cy = t.mine ? t.coinsGive : t.coinsWant, ct = t.mine ? t.coinsWant : t.coinsGive;
      const ST = { accepted: 'angenommen', declined: 'abgelehnt', cancelled: 'zurückgezogen', expired: 'abgelaufen' };
      return '<div class="card col" data-fr="card" style="gap:6px"><div class="row sb"><b>' + esc(other) + '</b>' + (tab === 'hist' ? '<span class="small">' + (ST[t.status] || t.status) + '</span>' : '') + '</div>' +
        '<p class="small">Du gibst: ' + bl(you) + (cy ? ' + ' + coinHTML(cy) : '') + '</p><p class="small">Du bekommst: ' + bl(they) + (ct ? ' + ' + coinHTML(ct) : '') + '</p>' + acts + '</div>';
    }).join('') : '<p class="center mute">Nichts da.</p>';
  }
  const tabs = [['in', 'Eingehend'], ['out', 'Ausgehend'], ['new', 'Neu'], ['hist', 'Verlauf']];
  show('<div class="col">' + backBar('Tauschen') + '<div class="tabs">' + tabs.map(t => '<button class="tab" data-fr="' + (tab === t[0] ? 'tabon' : 'tab') + '" data-act="ttab" data-v="' + t[0] + '"><span>' + t[1] + '</span></button>').join('') + '</div>' + body + '</div>');
}

/* ================= Freunde ================= */
function friends() {
  S.screen = 'friends'; setView(null);
  show('<div class="col">' + backBar('Mit Freunden') +
    '<p class="center">Erstelle einen Raum und gib deinen Freunden den Code. Leere Plätze füllen Bots auf. Es gibt keine Belohnung, aber auch keine Verluste.</p>' +
    btn('Raum erstellen: 1 gegen 1', 'room1') + btn('Raum erstellen: 2 gegen 2', 'room2', '', 'btn') +
    '<h3 class="center mt">Einem Raum beitreten</h3><div class="inp" data-fr="inp"><input id="rc" maxlength="4" placeholder="CODE" style="text-transform:uppercase;text-align:center;font-size:24px"></div>' + btn('Beitreten', 'roomjoin', '', 'btn2') + '</div>');
}
function roomScreen() {
  S.screen = 'room'; setView(null);
  const r = S.room, n = r.slots.length;
  const slot = i => {
    const nm = r.slots[i];
    return '<div class="listrow card" data-fr="card"><span class="grow">' + (nm ? '<b>' + esc(nm) + '</b>' + (i === r.youSlot ? ' (du)' : '') : '<span class="mute">frei (Bot)</span>') + '</span>' + (!nm ? '<button class="btn sm" data-fr="btn" data-act="roomslot" data-s="' + i + '"><span>Hierhin</span></button>' : '') + '</div>';
  };
  const teams = n === 2 ? '<h3>Spieler 1</h3>' + slot(0) + '<h3>Spieler 2</h3>' + slot(1)
    : '<h3 style="color:' + TEAM_COL[0] + '">Team Blau</h3>' + slot(0) + slot(1) + '<h3 style="color:' + TEAM_COL[1] + '">Team Rot</h3>' + slot(2) + slot(3);
  show('<div class="col"><h2 class="center jit">Raum</h2><p class="center">Code für deine Freunde:</p><div class="codebig jit">' + esc(r.code) + '</div>' + teams +
    (r.youHost ? btn('Kampf starten', 'roomstart') : '<p class="center mute">Warte, bis ' + esc(r.host) + ' startet.</p>') + btn('Raum verlassen', 'roomleave', '', 'btn2') + '</div>');
}

/* ================= Warteschlange ================= */
function queueScreen(m) {
  S.screen = 'queue'; setView(null);
  const t0 = Date.now();
  show('<div class="col center"><h2 class="jit">Suche Gegner ...</h2><div class="hero"><canvas class="ball" data-ball="' + topType() + '" data-size="170" data-fit=".62"></canvas></div>' +
    '<p>' + (m.mode === 2 ? 'Team-Kampf (2 gegen 2)' : 'Kampf (1 gegen 1)') + '</p><p id="qc" class="small"></p><div class="big" id="qt">0</div><p class="small mute">Wenn nach 15 Sekunden niemand gefunden wurde, spielt ein Bot mit.</p>' + btn('Abbrechen', 'unqueue', '', 'btn2') + '</div>');
  every(() => { const e = $('#qt'); if (e) e.textContent = Math.floor((Date.now() - t0) / 1000); }, 300);
  queueUpdate(m);
}
function queueUpdate(m) { const e = $('#qc'); if (e) e.textContent = m.count + ' Spieler in der Warteschlange'; }

/* ================= Kampf ================= */
const POS2 = [[.22, .5], [.78, .5]], POS4 = [[.25, .28], [.25, .72], [.75, .28], [.75, .72]];
function startPos(i, n) { return (n <= 2 ? POS2 : POS4)[i]; }
function livesHTML(team, count) {
  let h = ''; for (let i = 0; i < 3; i++) h += ico(i < count ? 'heart' : 'heart0', 26); return '<span class="lives" style="color:' + TEAM_COL[team] + '">' + h + '</span>';
}
function matchHeader() {
  const m = S.match, me = m.players[m.you], my = me.team, en = 1 - my;
  const nm = t => m.n === 2 ? esc(m.players.find(p => p.team === t).name) : (t === my ? 'Dein Team' : 'Gegner');
  return '<div class="row sb" id="mh"><div><div class="small" style="color:' + TEAM_COL[my] + '">' + (m.n === 2 ? 'Du' : 'Dein Team') + '</div>' + livesHTML(my, m.lives[my]) + '</div>' +
    '<div class="center small">' + (m.friendly ? 'Freundschaftsspiel' : 'Runde ' + m.round) + '</div>' +
    '<div style="text-align:right"><div class="small" style="color:' + TEAM_COL[en] + '">' + nm(en) + '</div>' + livesHTML(en, m.lives[en]) + '</div></div>';
}
function matchIntro() {
  const m = S.match; S.screen = 'matchintro'; setView(null);
  const nm = p => (p.slot === m.you ? 'Du' : esc(p.name) + (p.bot ? ' (Bot)' : ''));
  show('<div class="col center"><h2 class="jit">Gegner gefunden!</h2>' +
    (m.n === 2 ? '<p>' + nm(m.players[0]) + ' gegen ' + nm(m.players[1]) + '</p>' :
      '<p><b style="color:' + TEAM_COL[0] + '">Team Blau:</b> ' + [0, 1].map(i => nm(m.players[i])).join(' und ') + '</p><p><b style="color:' + TEAM_COL[1] + '">Team Rot:</b> ' + [2, 3].map(i => nm(m.players[i])).join(' und ') + '</p><p class="small mute">Eure Leben werden im Team geteilt.</p>') +
    '<p class="mute">Drei Leben. Wer keins mehr hat, verliert.</p></div>');
}
let pickSel = null, countdownEnd = 0;
function startCountdown(secs, id) {
  countdownEnd = Date.now() + secs * 1000;
  every(() => { const e = $(id || '#cd'); if (e) e.textContent = 'Noch ' + Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000)) + ' Sekunden'; }, 250);
}
function pickScreen(m) {
  const M = S.match; if (!M) return;
  M.round = m.round; M.lives = m.lives; S.screen = 'pick'; setView(null); pickSel = m.picked || null;
  show('<div class="col">' + matchHeader() + '<h2 class="center jit">Wähle deinen Ball</h2><p class="center small mute">Dein Gegner sieht ihn erst, wenn alle gewählt haben.</p><div id="cd" class="timer"></div>' +
    m.hand.map(h => {
      const d = DEFS[h.type];
      return '<button class="card pickrow" data-fr="card" data-strip="' + RARITY[d.rarity].color + '" data-act="pick" data-uid="' + h.uid + '"><canvas class="ball" data-ball="' + h.type + '" data-size="92" data-fit=".66"></canvas>' +
        '<div class="txt"><b>' + esc(d.name) + '</b>' + rarHTML(d.rarity) + '<span class="small">' + ico('heart', 18) + ' ' + d.hp + '   ' + ico('sword', 18) + ' ' + d.dmg + '</span><span class="small mute">' + esc(d.desc.split('.')[0]) + '.</span></div></button>';
    }).join('') + '<div id="pickbtn">' + btn('Diesen Ball wählen', 'pickgo', 'disabled') + '</div></div>');
  startCountdown(m.secs);
  if (pickSel) selectPick(pickSel, true);
}
function selectPick(uid, locked) {
  pickSel = uid;
  SCREEN.querySelectorAll('[data-act="pick"]').forEach(el => { el.dataset.fr = String(el.dataset.uid) === String(uid) ? 'btn' : 'card'; });
  const b = $('#pickbtn'); if (b && !locked) { b.innerHTML = btn('Diesen Ball wählen', 'pickgo'); decorate(b); }
  if (locked) { const b2 = $('#pickbtn'); if (b2) b2.innerHTML = '<p class="center">Gewählt. Warte auf die anderen ...</p>'; }
}
let dirDeg = 0, dirTouched = false, dirSent = false;
function dirScreen(m) {
  const M = S.match; if (!M) return;
  S.screen = 'dir'; dirSent = false; dirTouched = false;
  const n = M.n, balls = m.balls.map(b => ({ type: b.type, team: M.players[b.slot].team, deg: 0 }));
  const sim = createSim({ seed: 1, balls, noFx: true });
  const my = sim.balls.find(b => b.slot === M.you);
  const en = sim.balls.find(b => b.team !== my.team);
  dirDeg = Math.round((Math.atan2(en.y - my.y, en.x - my.x) * 180 / Math.PI + 360) % 360);
  const W = Math.min(window.innerWidth - 32, 440), AS = W - 8, H = AS + 10;
  show('<div class="col">' + matchHeader() + '<h2 class="center jit">Startrichtung</h2>' +
    '<p class="center small">Tippe in die Arena, um die Richtung deines Balls zu wählen. Ab dann fliegt er geradeaus und prallt ab. Dein Gegner wählt gleichzeitig.</p><div id="cd" class="timer"></div>' +
    '<canvas id="dc" class="view"></canvas>' + '<div class="small center">' + m.balls.map(b => { const p = M.players[b.slot]; return (b.slot === M.you ? 'Dein' : esc(p.name)) + ': <b style="color:' + TEAM_COL[p.team] + '">' + esc(ballName(b.type)) + '</b>'; }).join(' - ') + '</div>' +
    btn('Los!', 'dirgo') + '</div>');
  startCountdown(m.secs);
  const cv = $('#dc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const k = AS / BOX, ox = 4, oy = 4;
  const setDeg = ev => {
    const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left - ox) / k, y = (ev.clientY - r.top - oy) / k;
    dirDeg = Math.round((Math.atan2(y - my.y, x - my.x) * 180 / Math.PI + 360) % 360); dirTouched = true;
  };
  let down = false;
  cv.onpointerdown = ev => { down = true; cv.setPointerCapture(ev.pointerId); setDeg(ev); };
  cv.onpointermove = ev => { if (down) setDeg(ev); };
  cv.onpointerup = () => { down = false; };
  const auto = setTimeout(() => { if (!dirSent && dirTouched) sendDir(); }, Math.max(500, m.secs * 1000 - 700));
  S.timers.push(auto);
  setView({
    stop() { clearTimeout(auto); },
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      sim.fx.length = 0;
      drawArena(ctx, ox, oy, AS, sim, tf, tm, dt, M.you, M.players);
      const old = setTarget(ctx); T.f = tf;
      const a = dirDeg * Math.PI / 180, x0 = ox + my.x * k, y0 = oy + my.y * k, L = 54 + Math.sin(tm * 5) * 4;
      const x1 = x0 + Math.cos(a) * (my.r * k + L), y1 = y0 + Math.sin(a) * (my.r * k + L), xs = x0 + Math.cos(a) * (my.r * k + 6), ys = y0 + Math.sin(a) * (my.r * k + 6);
      const Z = { s: mulberry(7), f: mulberry(tf + 3) };
      line(Z, xs, ys, x1, y1, 4, '#d33a3a', { over: 0, bow: .05 });
      line(Z, x1, y1, x1 - Math.cos(a - .5) * 15, y1 - Math.sin(a - .5) * 15, 4, '#d33a3a', { over: 0, bow: 0 });
      line(Z, x1, y1, x1 - Math.cos(a + .5) * 15, y1 - Math.sin(a + .5) * 15, 4, '#d33a3a', { over: 0, bow: 0 });
      setTarget(old);
    }
  });
}
function sendDir() { if (dirSent) return; dirSent = true; wsSend({ t: 'dir', deg: dirDeg }); const b = $('#dc'); }

function fightScreen(m) {
  const M = S.match; if (!M) return;
  S.screen = 'fight'; clearFx();
  M.round = m.round;
  const sim = createSim(m.cfg);
  sim.slotMax = {}; for (const b of sim.balls) sim.slotMax[b.slot] = (sim.slotMax[b.slot] || 0) + b.maxHp;
  const W = Math.min(window.innerWidth - 32, 440), AS = W - 8, HUD = M.n === 2 ? 52 : 104, H = AS + HUD + 18;
  const myTeam = M.players[M.you].team;
  show('<div class="col">' + matchHeader() + '<div class="fightwrap"><canvas id="fc" class="view"></canvas></div><div id="fres"></div>' +
    '<div id="fbtn" class="row gap6"><div class="grow">' + btn('Überspringen', 'skip', '', 'btn2') + '</div></div></div>');
  const cv = $('#fc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  let acc = 0, over = false, overT = 0, sentReady = false, skipped = false;
  const finish = () => {
    over = true; overT = performance.now();
    const win = m.winner === myTeam;
    M.lives = m.lives; const mh = $('#mh'); if (mh) mh.outerHTML = matchHeader(); decorate(SCREEN);
    $('#fres').innerHTML = '<div class="panel center" data-fr="panel"><h2 class="jit" style="color:' + (win ? '#2f9a3a' : '#c93030') + '">' + (win ? 'Runde gewonnen!' : 'Runde verloren!') + '</h2><p class="small mute">' +
      (m.over ? (win ? 'Das war der letzte Kampf.' : 'Das war dein letztes Leben.') : (win ? 'Der Gegner verliert ein Leben.' : 'Du verlierst ein Leben.')) + '</p></div>';
    $('#fbtn').innerHTML = '<div class="grow">' + btn('Weiter', 'fightnext') + '</div>';
    decorate(SCREEN);
  };
  S.fightNext = () => { if (!sentReady) { sentReady = true; wsSend({ t: 'ready' }); const b = $('#fbtn'); if (b) b.innerHTML = '<p class="center mute">Warte auf die anderen ...</p>'; } };
  S.fightSkip = () => {
    if (over) return; skipped = true; sim.noFx = true; let g2 = 6000;
    while (!sim.over && g2-- > 0 && sim.step < m.steps + 5) stepSim(sim);
    sim.fx.length = 0; clearFx();
  };
  setView({
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      if (!over) {
        acc += Math.min(dt, .05);
        let n = 0;
        while (acc >= DT && !sim.over && n++ < 8) { stepSim(sim); acc -= DT; }
        if (!sim.over && sim.step >= m.steps + 5) { sim.over = true; sim.winner = m.winner; }
        if (sim.over) { sim.winner = m.winner; finish(); }
      } else if (!sentReady && performance.now() - overT > 4500) S.fightNext();
      drawArena(ctx, 4, 4, AS, sim, tf, tm, dt, M.you, M.players);
      drawHud(ctx, 4, AS + 14, W - 8, sim, M.players, M.you, tf);
    }
  });
}

function matchEnd(m) {
  S.match = null; S.screen = 'end'; setView(null);
  if (m.me) S.me = m.me;
  show('<div class="col center"><h1 class="jit" style="color:' + (m.win ? '#2f9a3a' : '#c93030') + '">' + (m.win ? 'Sieg!' : 'Niederlage') + '</h1>' +
    '<div class="hero"><canvas class="ball" data-ball="' + topType() + '" data-size="170" data-fit=".62"></canvas></div>' +
    (m.friendly ? '<p>Freundschaftsspiel - keine Belohnung.</p>' : '<div class="panel" data-fr="panel"><p>Belohnung:</p><div class="big">' + coinHTML('+' + m.coins) + '</div></div>') +
    btn('Nochmal kämpfen', 'queue1') + btn('Zur Startseite', 'home', '', 'btn2') + '</div>');
}

/* ================= Aktionen ================= */
const ACT = {
  reload() { location.reload(); },
  home() { closeOverlay(); home(); },
  closeov() { closeOverlay(); },
  async register() {
    const name = $('#nm').value.trim();
    const r = await api('/api/login', { name });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    connectWS(); home();
  },
  queue1() { if (S.match) return; wsSend({ t: 'queue', mode: 1 }); },
  queue2() { if (S.match) return; wsSend({ t: 'queue', mode: 2 }); },
  unqueue() { wsSend({ t: 'unqueue' }); },
  friends() { friends(); },
  room1() { wsSend({ t: 'room_create', mode: 1 }); },
  room2() { wsSend({ t: 'room_create', mode: 2 }); },
  roomjoin() { const c = ($('#rc').value || '').trim(); if (c.length < 4) { toast('Gib den 4-stelligen Code ein.'); return; } wsSend({ t: 'room_join', code: c }); },
  roomslot(d) { wsSend({ t: 'room_slot', slot: +d.s }); },
  roomstart() { wsSend({ t: 'room_start' }); },
  roomleave() { wsSend({ t: 'room_leave' }); },
  collection() { collection(); },
  filter(d) { S.filter = d.v; collection(); },
  detail(d) { detail(d.t); },
  async mklist(d) {
    const price = parseInt(($('#pr' + d.uid) || {}).value, 10);
    const r = await api('/api/market/list', { uid: +d.uid, price });
    if (r.err) { toast(errText(r.err)); return; }
    toast('Ball steht jetzt auf dem Markt.'); closeOverlay(); collection();
  },
  async mkcancel(d) {
    const r = await api('/api/market/cancel', { uid: +d.uid });
    if (r.err) { toast(errText(r.err)); return; }
    toast('Angebot zurückgezogen.'); closeOverlay(); if (d.back === 'market') market(); else collection();
  },
  box() { boxScreen(); },
  openbox() { openBox(); },
  market() { market(true); },
  mktab(d) { S.mk.tab = d.v; market(true); },
  mkrar(d) { S.mk.rarity = d.v; market(true); },
  mksort(d) { S.mk.sort = d.v; market(true); },
  mksearch() { S.mk.q = ($('#mkq').value || '').trim(); market(true); },
  mkprev() { S.mk.page--; market(); },
  mknext() { S.mk.page++; market(); },
  async mkbuy(d) {
    const r = await api('/api/market/buy', { uid: +d.uid });
    if (r.err) { toast(errText(r.err)); if (r.err === 'gone') market(); return; }
    toast(ballName(r.type) + ' gekauft!'); market();
  },
  trades() { S.tr.tab = 'in'; trades(); },
  ttab(d) { S.tr.tab = d.v; trades(); },
  async tfind() {
    const name = ($('#tname').value || '').trim(); S.tnew.name = name;
    const r = await api('/api/player', { name });
    if (r.err) { $('#err').textContent = errText(r.err); S.tnew.player = null; return; }
    if (r.self) { $('#err').textContent = errText('self'); return; }
    S.tnew.player = r.player; S.tnew.give = new Set(); S.tnew.want = new Set(); trades();
  },
  tgive(d) { const s = S.tnew.give, u = +d.uid; s.has(u) ? s.delete(u) : s.add(u); keepTradeInputs(); },
  twant(d) { const s = S.tnew.want, u = +d.uid; s.has(u) ? s.delete(u) : s.add(u); keepTradeInputs(); },
  async tsend() {
    const t = S.tnew;
    const r = await api('/api/trade/create', {
      to: t.player.name, give: [...t.give], want: [...t.want],
      coinsGive: parseInt($('#cgive').value, 10) || 0, coinsWant: parseInt($('#cwant').value, 10) || 0
    });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    toast('Angebot gesendet.'); S.tnew = { name: '', player: null, give: new Set(), want: new Set() }; S.tr.tab = 'out'; trades();
  },
  async tans(d) {
    const r = await api('/api/trade/answer', { id: +d.id, action: d.a });
    if (r.err) { toast(errText(r.err)); trades(); return; }
    toast(d.a === 'accept' ? 'Tausch abgeschlossen!' : 'Erledigt.'); trades();
  },
  async daily() {
    const r = await api('/api/daily');
    if (r.err) { toast(errText(r.err)); return; }
    toast('+' + r.gain + ' Münzen (Tag ' + r.streak + ' in Folge)'); home();
  },
  rename() {
    overlay('<div class="col"><h2 class="jit">Neuer Name</h2><div class="inp" data-fr="inp"><input id="nn" maxlength="16" value="' + esc(S.me.name) + '"></div><div class="err" id="err"></div>' + btn('Speichern', 'renamego') + btn('Abbrechen', 'closeov', '', 'btn2') + '</div>');
  },
  async renamego() {
    const r = await api('/api/rename', { name: $('#nn').value.trim() });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    closeOverlay(); home();
  },
  pick(d) { selectPick(d.uid); },
  pickgo() { if (pickSel == null) return; wsSend({ t: 'pick', uid: +pickSel }); selectPick(pickSel, true); },
  dirgo() { sendDir(); const b = SCREEN.querySelector('[data-act="dirgo"]'); if (b) b.outerHTML = '<p class="center">Gewählt. Warte auf die anderen ...</p>'; },
  skip() { if (S.fightSkip) S.fightSkip(); },
  fightnext() { if (S.fightNext) S.fightNext(); }
};
function keepTradeInputs() {
  const a = ($('#cgive') || {}).value, b = ($('#cwant') || {}).value, nm = ($('#tname') || {}).value;
  S.tnew.name = nm || S.tnew.name;
  trades().then(() => { if ($('#cgive')) $('#cgive').value = a || ''; if ($('#cwant')) $('#cwant').value = b || ''; });
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) fn(t.dataset, t, ev);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'nm') ACT.register();
});

boot();
