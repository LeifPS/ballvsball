// Spiel-Lobby und Kämpfe: Warteschlange, Freundesräume, Teams (2 gegen 2), Bots.
// Der Server entscheidet jeden Kampf mit derselben deterministischen Engine wie der Browser.
import { DurableObject } from 'cloudflare:workers';
import { hash } from './hash.js';
import { runFight, DEFS, BALL_IDS, DT } from '../public/js/engine.js';

const LIVES = 3, LIVES_FFA = 2;   // Mehrspieler (3 oder 4 Spieler, jeder gegen jeden): weniger Leben, damit es nicht ewig dauert
const QUEUE_WAIT = 15000;
const PICK_SECS = 15, DIR_SECS = 12;
const BOT_NAMES = ['Kugel-Karl', 'Rollo', 'Bella Bounce', 'Dotti', 'Prall', 'Hopsi', 'Rumpel', 'Klecks', 'Purzel', 'Mocca', 'Fleck', 'Pünktchen'];
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function rnd() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
// Spielerzahl je Modus: 1 = 1 gegen 1, 3 und 4 = jeder gegen jeden, 2 = Team-Kampf (derzeit abgeschaltet)
const playersOf = mode => mode === 1 ? 2 : mode;
function rint(n) { return Math.floor(rnd() * n); }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const BOT_W = { gewoehnlich: 52, selten: 30, episch: 14, legendaer: 4 };
function botType() {
  const ids = BALL_IDS.filter(id => DEFS[id].box === 'standard');   // Bots haben nur Standardbälle
  const w = ids.map(id => BOT_W[DEFS[id].rarity] / ids.filter(x => DEFS[x].rarity === DEFS[id].rarity).length);
  let s = 0; for (const x of w) s += x;
  let r = rnd() * s;
  for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r < 0) return ids[i]; }
  return ids[0];
}

const RAR_ORDER = ['gewoehnlich', 'selten', 'episch', 'legendaer'];
// Hand: drei verschiedene Sorten. Jede Sorte zählt gleich, egal wie viele Exemplare man besitzt.
// Pro Platz wird eine Seltenheit mit festen Gewichten gewürfelt. Hat man davon keine freie Sorte mehr, gilt die nächst schlechtere,
// und nur wenn es keine schlechtere gibt, die nächst bessere. So wird keine Chance durch zusätzliche Bälle schlechter.
const HAND_W = [40, 30, 20, 10];   // gewoehnlich, selten, episch, legendaer
function pickHand(inv) {
  const by = new Map();
  for (const b of inv) { const c = by.get(b.type); if (!c || (b.stars || 0) > (c.stars || 0)) by.set(b.type, b); }
  const pools = [[], [], [], []];
  for (const b of by.values()) pools[RAR_ORDER.indexOf(DEFS[b.type].rarity)].push(b);
  const hand = [];
  while (hand.length < 3 && pools.some(p => p.length)) {
    let k = 0, r = rnd() * 100;
    while (k < 3 && (r -= HAND_W[k]) >= 0) k++;
    while (k >= 0 && !pools[k].length) k--;
    if (k < 0) { k = 0; while (!pools[k].length) k++; }
    hand.push(pools[k].splice(rint(pools[k].length), 1)[0]);
  }
  return hand;
}
// Bots ziehen ihre Bälle unabhängig vom Spieler: feste Seltenheits-Gewichte (BOT_W), nur Standardbälle
function botHand() {
  const types = [];
  for (let i = 0; i < 60 && types.length < 3; i++) { const t = botType(); if (!types.includes(t)) types.push(t); }
  return types.map((type, i) => ({ uid: -100 - i, type }));
}

export class Game extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.conns = new Set();
    this.byUser = new Map();      // userId -> conn
    this.queue = { 1: [], 2: [], 3: [], 4: [] };
    this.qtimer = { 1: null, 2: null, 3: null, 4: null };
    this.rooms = new Map();
    this.matches = new Map();
    this.userMatch = new Map();   // userId -> match
    this.nextMatch = 1;
  }
  store() { return this.env.STORE.get(this.env.STORE.idFromName('main')); }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ws erwartet', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const c = { ws: server, user: null, token: null, room: null, queued: 0, match: null, p: null, last: 0 };
    this.conns.add(c);
    server.addEventListener('message', ev => {
      this.onMessage(c, ev.data).catch(e => { console.log('msg error', e && e.stack || e); });
    });
    const gone = () => this.onClose(c);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(c, o) {
    if (!c || !c.ws) return;
    try { c.ws.send(JSON.stringify(o)); } catch (e) { /* Verbindung weg */ }
  }

  async onMessage(c, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { this.send(c, { t: 'pong' }); return; }
    if (m.t === 'hello') {
      if (c.user || typeof m.token !== 'string') return;
      const tk = await hash(m.token);
      const u = await this.store().auth(tk);
      if (!u) { this.send(c, { t: 'hello', ok: false }); return; }
      const old = this.byUser.get(u.id);
      if (old && old !== c) { this.send(old, { t: 'kicked' }); this.onClose(old, true); try { old.ws.close(); } catch (e) { } }
      c.user = u; c.token = tk;
      this.byUser.set(u.id, c);
      const match = this.userMatch.get(u.id);
      this.send(c, { t: 'hello', ok: true, name: u.name, inMatch: !!match });
      if (match) this.reattach(match, c);
      return;
    }
    if (!c.user) return;
    switch (m.t) {
      case 'queue': return this.joinQueue(c, m.mode === 3 ? 3 : m.mode === 4 ? 4 : 1);   // Team-Kampf (2 gegen 2) ist vorerst abgeschaltet
      case 'unqueue': return this.leaveQueue(c);
      case 'room_create': return this.roomCreate(c, m.mode === 3 ? 3 : m.mode === 4 ? 4 : 1);
      case 'room_join': return this.roomJoin(c, String(m.code || '').toUpperCase().trim());
      case 'room_slot': return this.roomSlot(c, m.slot);
      case 'room_leave': return this.roomLeave(c);
      case 'room_start': return this.roomStart(c);
      case 'pick': return this.onPick(c, m.uid);
      case 'dir': return this.onDir(c, m.deg);
      case 'ready': return this.onReady(c);
      case 'leave': return this.onLeaveMatch(c);
    }
  }

  onClose(c, silent) {
    if (!this.conns.has(c)) return;
    this.conns.delete(c);
    if (c.user && this.byUser.get(c.user.id) === c) this.byUser.delete(c.user.id);
    this.leaveQueue(c, true);
    this.roomLeave(c, true);
    if (c.match && c.p && c.p.conn === c) {
      c.p.conn = null;
      const m = c.match;
      // Kurze Verbindungsabbrüche (Handy-Netz) sollen den Kampf nicht beenden: 45 s Zeit zum Wiederverbinden
      if (!this.humansActive(m) && !m.grace) m.grace = setTimeout(() => { m.grace = 0; if (!m.over && !this.humansActive(m)) this.abort(m); }, 45000);
      this.progress(m);
    }
  }

  /* ---------- Warteschlange ---------- */
  joinQueue(c, mode) {
    if (c.match || c.room || c.queued) return;
    c.queued = mode;
    const q = this.queue[mode];
    q.push(c);
    this.send(c, { t: 'queued', mode, wait: QUEUE_WAIT / 1000, count: q.length });
    const need = playersOf(mode);
    if (q.length >= need) { this.fireQueue(mode); return; }
    if (!this.qtimer[mode]) this.qtimer[mode] = setTimeout(() => this.fireQueue(mode), QUEUE_WAIT);
    for (const o of q) this.send(o, { t: 'queued', mode, wait: QUEUE_WAIT / 1000, count: q.length });
  }
  leaveQueue(c, quiet) {
    if (!c.queued) return;
    const mode = c.queued;
    c.queued = 0;
    const q = this.queue[mode];
    const i = q.indexOf(c);
    if (i >= 0) q.splice(i, 1);
    if (!q.length && this.qtimer[mode]) { clearTimeout(this.qtimer[mode]); this.qtimer[mode] = null; }
    if (!quiet) this.send(c, { t: 'unqueued' });
  }
  fireQueue(mode) {
    if (this.qtimer[mode]) { clearTimeout(this.qtimer[mode]); this.qtimer[mode] = null; }
    const cap = playersOf(mode);
    const q = this.queue[mode];
    const take = q.splice(0, cap);
    for (const c of take) c.queued = 0;
    if (take.length) this.startMatch(mode, take.map((c, i) => ({ conn: c, slot: mode === 1 ? i : i })), false);
    if (q.length) this.qtimer[mode] = setTimeout(() => this.fireQueue(mode), QUEUE_WAIT);
  }

  /* ---------- Freundesräume ---------- */
  roomSlots(r) { return playersOf(r.mode); }
  roomMsg(r) {
    const slots = [];
    for (let i = 0; i < this.roomSlots(r); i++) slots.push(null);
    for (const m of r.members) slots[m.slot] = m.conn.user.name;
    return { t: 'room', code: r.code, mode: r.mode, slots, host: r.host.user.name };
  }
  roomBroadcast(r) {
    const msg = this.roomMsg(r);
    for (const m of r.members) this.send(m.conn, Object.assign({ youHost: m.conn === r.host, youSlot: m.slot }, msg));
  }
  roomCreate(c, mode) {
    if (c.match || c.room || c.queued) return;
    let code;
    do { code = ''; for (let i = 0; i < 4; i++) code += CODE_CH[rint(CODE_CH.length)]; } while (this.rooms.has(code));
    const r = { code, mode, host: c, members: [{ conn: c, slot: 0 }] };
    this.rooms.set(code, r);
    c.room = r;
    this.roomBroadcast(r);
  }
  roomJoin(c, code) {
    if (c.match || c.room || c.queued) return;
    const r = this.rooms.get(code);
    if (!r) { this.send(c, { t: 'error', code: 'room_unknown' }); return; }
    const order = r.mode === 1 ? [0, 1] : r.mode === 2 ? [2, 1, 3, 0] : [0, 1, 2, 3];
    const free = order.find(s => !r.members.some(m => m.slot === s));
    if (free === undefined) { this.send(c, { t: 'error', code: 'room_full' }); return; }
    r.members.push({ conn: c, slot: free });
    c.room = r;
    this.roomBroadcast(r);
  }
  roomSlot(c, slot) {
    const r = c.room;
    slot = Math.floor(Number(slot));
    if (!r || !(slot >= 0 && slot < this.roomSlots(r))) return;
    if (r.members.some(m => m.slot === slot)) return;
    r.members.find(m => m.conn === c).slot = slot;
    this.roomBroadcast(r);
  }
  roomLeave(c, quiet) {
    const r = c.room;
    if (!r) return;
    c.room = null;
    r.members = r.members.filter(m => m.conn !== c);
    if (!quiet) this.send(c, { t: 'room_left' });
    if (!r.members.length) { this.rooms.delete(r.code); return; }
    if (r.host === c) r.host = r.members[0].conn;
    this.roomBroadcast(r);
  }
  roomStart(c) {
    const r = c.room;
    if (!r || r.host !== c) return;
    this.rooms.delete(r.code);
    for (const m of r.members) m.conn.room = null;
    this.startMatch(r.mode, r.members.map(m => ({ conn: m.conn, slot: m.slot })), true);
  }

  /* ---------- Kampf ---------- */
  async startMatch(mode, humans, friendly) {
    const n = playersOf(mode), ffa = mode >= 3;
    const players = [];
    for (let s = 0; s < n; s++) {
      players.push({
        slot: s, team: mode === 2 ? s >> 1 : s, out: false, userId: 0, name: '', bot: true, conn: null, token: null, inv: [],
        hand: [], pick: null, dir: null, ready: true, left: false, last: null
      });
    }
    // Bots verteilen: Menschen auf angegebene Plätze
    const used = new Set();
    for (const h of humans) {
      const p = players[h.slot];
      p.bot = false; p.conn = h.conn; p.userId = h.conn.user.id; p.name = h.conn.user.name; p.token = h.conn.token;
      used.add(h.slot);
    }
    const names = shuffle(BOT_NAMES);
    for (const p of players) if (p.bot) p.name = names.pop();
    const m = {
      id: this.nextMatch++, mode, n, ffa, friendly, players, lives: ffa ? Array(n).fill(LIVES_FFA) : [LIVES, LIVES], outCount: 0, round: 0, phase: 'load',
      timer: null, deadline: 0, over: false, aborted: false
    };
    this.matches.set(m.id, m);
    for (const p of players) if (!p.bot) { p.conn.match = m; p.conn.p = p; this.userMatch.set(p.userId, m); }
    for (const p of players) {
      if (p.bot) continue;
      try { p.inv = await this.store().inventory(p.userId); } catch (e) { p.inv = []; }
      while (p.inv.length < 3) p.inv.push({ uid: -1 - p.inv.length, type: ['stachel', 'turret', 'ramm'][p.inv.length] });
    }
    if (m.aborted) return;
    const pl = players.map(p => ({ slot: p.slot, name: p.name, team: p.team, bot: p.bot }));
    for (const p of players) {
      if (p.bot) continue;
      this.send(p.conn, { t: 'match_start', id: m.id, mode, n, ffa: m.ffa, friendly, players: pl, you: p.slot, lives: m.lives });
    }
    this.startRound(m);
  }

  humansActive(m) { return m.players.some(p => !p.bot && !p.left && !p.out && p.conn); }
  livePlayers(m) { return m.players.filter(p => !p.out); }

  startRound(m) {
    if (m.aborted) return;
    m.round++;
    m.phase = 'pick';
    const live = this.livePlayers(m);
    for (const p of live) {
      p.pick = null; p.dir = null; p.ready = false;
      if (!p.bot && !p.left) p.hand = pickHand(p.inv);
    }
    for (const p of live) {
      if (p.bot || p.left) { p.hand = botHand(); p.pick = p.hand[rint(3)]; }
    }
    m.deadline = Date.now() + PICK_SECS * 1000;
    for (const p of live) {
      if (p.bot || !p.conn) continue;
      p.last = { t: 'pick_phase', round: m.round, hand: p.hand, secs: PICK_SECS, lives: m.lives };
      this.send(p.conn, p.last);
    }
    clearTimeout(m.timer);
    m.timer = setTimeout(() => this.endPick(m), PICK_SECS * 1000 + 600);
    this.progress(m);
  }

  // Prüft, ob die aktuelle Phase vorzeitig enden kann
  progress(m) {
    if (m.aborted || m.over) return;
    const act = m.players.filter(p => !p.bot && !p.left && !p.out);
    if (m.phase === 'pick') {
      // Getrennte Spieler: automatisch wählen lassen
      if (act.every(p => p.pick || !p.conn)) this.endPick(m);
    } else if (m.phase === 'dir') {
      if (act.every(p => p.dir !== null || !p.conn)) this.endDir(m);
    } else if (m.phase === 'fight') {
      if (act.every(p => p.ready || !p.conn)) this.endFight(m);
    }
  }

  onPick(c, uid) {
    const m = c.match, p = c.p;
    if (!m || m.phase !== 'pick' || p.pick || p.out) return;
    const h = p.hand.find(x => x.uid === Math.floor(Number(uid)));
    if (!h) return;
    p.pick = h;
    this.send(c, { t: 'picked' });
    this.progress(m);
  }
  endPick(m) {
    if (m.phase !== 'pick' || m.aborted) return;
    clearTimeout(m.timer);
    const live = this.livePlayers(m);
    for (const p of live) if (!p.pick) p.pick = p.hand[rint(p.hand.length)];
    m.phase = 'dir';
    m.deadline = Date.now() + DIR_SECS * 1000;
    const balls = live.map(p => ({ slot: p.slot, type: p.pick.type }));
    for (const p of live) {
      if (p.bot || p.left) { p.dir = rnd() * 360; continue; }
      p.last = { t: 'reveal', round: m.round, balls, secs: DIR_SECS };
      this.send(p.conn, p.last);
    }
    m.timer = setTimeout(() => this.endDir(m), DIR_SECS * 1000 + 600);
    this.progress(m);
  }
  onDir(c, deg) {
    const m = c.match, p = c.p;
    if (!m || m.phase !== 'dir' || p.dir !== null || p.out) return;
    deg = Number(deg);
    if (!Number.isFinite(deg)) return;
    p.dir = ((deg % 360) + 360) % 360;
    this.send(c, { t: 'dir_ok' });
    this.progress(m);
  }
  endDir(m) {
    if (m.phase !== 'dir' || m.aborted) return;
    clearTimeout(m.timer);
    const live = this.livePlayers(m);
    for (const p of live) if (p.dir === null) p.dir = rnd() * 360;
    // Winkel auf 0,1 Grad runden, damit JSON-Zahlen sicher gleich bleiben
    const cfg = {
      seed: rint(2000000000) + 1, total: m.n,
      balls: live.map(p => ({ slot: p.slot, type: p.pick.type, team: p.team, deg: Math.round(p.dir * 10) / 10, stars: p.pick.stars || 0 }))
    };
    const res = runFight(cfg);
    if (m.ffa) {
      // Jeder gegen jeden: Wer zuerst komplett besiegt wurde, verliert ein Leben (bei Gleichstand niemand).
      // Läuft die Zeit ab, ohne dass jemand besiegt wurde, verliert das Team mit den wenigsten Lebenspunkten.
      let first = -1;
      if (res.elim.length) {
        const tied = res.elim.filter(e => e.step === res.elim[0].step);
        if (tied.length === 1) first = tied[0].team;
      } else {
        const fr = Object.entries(res.frac).map(([t, f]) => [Number(t), f]).sort((x, y) => x[1] - y[1]);
        if (fr.length > 1 && fr[0][1] < fr[1][1] - 1e-9) first = fr[0][0];
      }
      if (first >= 0) m.lives[first]--;
      const left = live.filter(p => m.lives[p.team] > 0).length;
      m.fight = { cfg, steps: res.steps, winner: res.winner, first, elim: res.elim.map(e => e.team), reason: res.reason, lives: m.lives.slice(), over: left <= 1, round: m.round };
    } else {
      const draw = res.winner < 0;   // Unentschieden: keine Leben abziehen
      if (!draw) m.lives[1 - res.winner]--;
      const over = !draw && m.lives[1 - res.winner] <= 0;
      m.fight = { cfg, steps: res.steps, winner: res.winner, reason: res.reason, lives: m.lives.slice(), over, round: m.round };
    }
    m.phase = 'fight';
    for (const p of live) {
      p.ready = p.bot || p.left;
      if (p.bot || p.left) continue;
      p.last = Object.assign({ t: 'fight' }, m.fight);
      this.send(p.conn, p.last);
    }
    m.deadline = Date.now() + res.steps * DT * 1000 + 40000;
    m.timer = setTimeout(() => this.endFight(m), res.steps * DT * 1000 + 40000);
    this.progress(m);
  }
  onReady(c) {
    const m = c.match, p = c.p;
    // Kein Kampf mehr (z. B. nach einem Neustart des Servers): Client zurück zur Startseite schicken statt ewig warten zu lassen
    if (!m || m.aborted || m.over) { this.send(c, { t: 'left' }); return; }
    // Die Runde ist schon weiter (Nachricht ging verloren): letzten Stand noch einmal senden, damit der Client aufholt
    if (m.phase !== 'fight') { this.resend(m, c); return; }
    p.ready = true;
    this.progress(m);
  }
  resend(m, c) {
    const p = c.p;
    if (!p || !p.last) return;
    const msg = Object.assign({}, p.last);
    if (msg.t === 'pick_phase' || msg.t === 'reveal') msg.secs = Math.max(1, Math.round((m.deadline - Date.now()) / 1000));
    if (msg.t === 'pick_phase' && p.pick) msg.picked = p.pick.uid;
    this.send(c, msg);
  }
  endFight(m) {
    if (m.phase !== 'fight' || m.aborted) return;
    clearTimeout(m.timer);
    if (m.ffa) { this.endFightFfa(m); return; }
    if (m.fight.over) { this.finishMatch(m, m.fight.winner); return; }
    m.phase = 'wait';
    m.timer = setTimeout(() => this.startRound(m), 600);
  }
  // Mehrspieler: wer kein Leben mehr hat, scheidet aus und bekommt sofort sein Ergebnis (Platz = Zahl der noch Aktiven vor dem Ausscheiden)
  endFightFfa(m) {
    const live = this.livePlayers(m);
    for (const p of live.filter(q => m.lives[q.team] <= 0)) {
      const place = this.livePlayers(m).length;
      p.out = true;
      this.eliminate(m, p, place);
    }
    const rest = this.livePlayers(m);
    if (rest.length <= 1) {
      m.over = true; m.phase = 'done';
      this.matches.delete(m.id);
      if (rest[0]) { rest[0].out = true; this.eliminate(m, rest[0], 1); }
      return;
    }
    if (!this.humansActive(m)) { this.abort(m); return; }
    m.phase = 'wait';
    m.timer = setTimeout(() => this.startRound(m), 600);
  }
  async eliminate(m, p, place) {
    if (p.bot) return;
    this.userMatch.delete(p.userId);
    const conn = p.conn;
    p.conn = null;
    if (conn) { conn.match = null; conn.p = null; }
    let coins = 0, tokens = 0, me = null;
    if (!m.friendly && !p.left) {
      const bots = m.players.some(o => o.bot);
      const table = bots ? [60, 30, 15, 8] : [90, 50, 25, 10];
      coins = table[place - 1] || 5;
      try { tokens = await this.store().reward(p.userId, coins, place === 1, place === 1 ? (bots ? 2 : 3) : 1) || 0; } catch (e) { console.log('reward', e); }
    }
    try { const x = await this.store().me(p.token); if (x.ok) me = x.me; } catch (e) { }
    this.send(conn, { t: 'match_end', ffa: true, place, n: m.n, win: place === 1, winnerTeam: -1, coins, tokens, friendly: m.friendly, me });
  }

  async finishMatch(m, winnerTeam) {
    m.over = true; m.phase = 'done';
    this.matches.delete(m.id);
    const results = [];
    for (const p of m.players) {
      if (p.bot) continue;
      this.userMatch.delete(p.userId);
      const win = p.team === winnerTeam;
      let coins = 0, tokens = 0;
      if (!m.friendly && !p.left) {
        const botOpp = m.players.some(o => o.bot && o.team !== p.team);
        coins = win ? (botOpp ? 40 : 60) : (botOpp ? 10 : 20);   // Münzen pro Kampf: gegen Bot 40 / 10, gegen Menschen 60 / 20
        try { tokens = await this.store().reward(p.userId, coins, win, win ? (botOpp ? 2 : 3) : 1) || 0; } catch (e) { console.log('reward', e); }
      }
      results.push({ p, win, coins, tokens });
    }
    for (const r of results) {
      let me = null;
      try { const x = await this.store().me(r.p.token); if (x.ok) me = x.me; } catch (e) { }
      if (r.p.conn) {
        r.p.conn.match = null; r.p.conn.p = null;
        this.send(r.p.conn, { t: 'match_end', winnerTeam, win: r.win, coins: r.coins, tokens: r.tokens, friendly: m.friendly, me });
      }
    }
  }

  onLeaveMatch(c) {
    const m = c.match, p = c.p;
    if (!m) return;
    p.left = true; p.conn = null;
    this.userMatch.delete(p.userId);
    c.match = null; c.p = null;
    this.send(c, { t: 'left' });
    if (!this.humansActive(m)) this.abort(m);
    else this.progress(m);
  }
  abort(m) {
    m.aborted = true; m.over = true;
    clearTimeout(m.timer); clearTimeout(m.grace);
    this.matches.delete(m.id);
    for (const p of m.players) {
      if (!p.bot) { this.userMatch.delete(p.userId); if (p.conn) { p.conn.match = null; p.conn.p = null; } }
    }
  }
  reattach(m, c) {
    const p = m.players.find(x => x.userId === c.user.id);
    if (!p || p.left) return;
    p.conn = c; c.match = m; c.p = p;
    clearTimeout(m.grace); m.grace = 0;
    const pl = m.players.map(x => ({ slot: x.slot, name: x.name, team: x.team, bot: x.bot }));
    this.send(c, { t: 'match_start', id: m.id, mode: m.mode, n: m.n, ffa: m.ffa, friendly: m.friendly, players: pl, you: p.slot, lives: m.lives, resume: true });
    if (p.last) {
      const msg = Object.assign({}, p.last);
      if (msg.t === 'pick_phase' || msg.t === 'reveal') msg.secs = Math.max(1, Math.round((m.deadline - Date.now()) / 1000));
      if (msg.t === 'pick_phase' && p.pick) msg.picked = p.pick.uid;
      this.send(c, msg);
    }
  }
}
